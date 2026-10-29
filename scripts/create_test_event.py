import os
import sys
import uuid
import requests
import numpy as np
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.config import settings
from app.database import SessionLocal
from app.models import Photographer, Event, Photo, FaceEmbedding
from app.services import faces
from app.services.storage import get_storage_provider, generate_thumbnail, generate_storage_key

USER_PHOTO_PATH = r"C:\Users\admin\.gemini\antigravity\brain\7aebac0c-3074-48d1-8bc2-a3d33ff6cb25\.user_uploaded\media_1793266162570_2f9ede1e.png"
EVENT_SLUG = "demo-2026"
EVENT_NAME = "VIP Demo Event 2026"

def main():
    print("=" * 60)
    print(f"🎉 Setting Up Test Event: '{EVENT_NAME}' (Code/Slug: {EVENT_SLUG})")
    print("=" * 60)

    # 1. Step 1: Ensure event exists in DB first
    db = SessionLocal()
    try:
        photographer = db.query(Photographer).first()
        if not photographer:
            photographer = Photographer(
                id=uuid.uuid4(),
                email="faizkhan7725@gmail.com",
                name="Faiz Khan Studio",
            )
            db.add(photographer)
            db.commit()
            db.refresh(photographer)
        print(f"✅ Photographer: {photographer.name} ({photographer.email})")

        event = db.query(Event).filter(Event.slug == EVENT_SLUG).first()
        if not event:
            event = Event(
                id=uuid.uuid4(),
                photographer_id=photographer.id,
                name=EVENT_NAME,
                slug=EVENT_SLUG,
                source_type="direct",
                status="active",
            )
            db.add(event)
            db.commit()
            db.refresh(event)
        event_id = event.id
        print(f"✅ Event ready: ID={event_id}, Slug='{EVENT_SLUG}'")
    finally:
        db.close()

    # 2. Step 2: Download photos and process with AI (offline from DB)
    storage = get_storage_provider()
    tasks = []
    for i in range(1, 16):
        tasks.append((f"portrait_man_{i}.jpg", f"https://randomuser.me/api/portraits/men/{i}.jpg"))
    for i in range(1, 16):
        tasks.append((f"portrait_woman_{i}.jpg", f"https://randomuser.me/api/portraits/women/{i}.jpg"))

    processed_items = []
    print(f"\n📸 Downloading and processing {len(tasks)} sample portraits...")
    for idx, (filename, url) in enumerate(tasks, start=1):
        try:
            res = requests.get(url, timeout=10)
            if res.status_code != 200:
                continue
            img_bytes = res.content
            photo_key = generate_storage_key(event_id, filename, is_thumbnail=False)
            thumb_key = generate_storage_key(event_id, filename, is_thumbnail=True)

            storage.save_file(img_bytes, photo_key)
            thumb_bytes = generate_thumbnail(img_bytes, max_width=400)
            storage.save_file(thumb_bytes, thumb_key)

            detected_faces = faces.extract_faces(img_bytes)
            processed_items.append({
                "filename": filename,
                "bytes_len": len(img_bytes),
                "photo_key": photo_key,
                "thumb_key": thumb_key,
                "description": f"Guest portrait #{idx}",
                "faces": detected_faces,
            })
            print(f"  [{idx}/{len(tasks)}] Processed {filename} ({len(detected_faces)} face)")
        except Exception as e:
            print(f"  [{idx}] Error: {e}")

    # Process user photo
    print(f"\n⭐ Processing USER Photo: {USER_PHOTO_PATH}")
    with open(USER_PHOTO_PATH, "rb") as f:
        user_bytes = f.read()

    user_filename = "faiz_vip_guest.png"
    photo_key = generate_storage_key(event_id, user_filename, is_thumbnail=False)
    thumb_key = generate_storage_key(event_id, user_filename, is_thumbnail=True)

    storage.save_file(user_bytes, photo_key)
    thumb_bytes = generate_thumbnail(user_bytes, max_width=400)
    storage.save_file(thumb_bytes, thumb_key)

    user_faces = faces.extract_faces(user_bytes)
    print(f"  Detected {len(user_faces)} face(s) in user photo!")
    processed_items.append({
        "filename": user_filename,
        "bytes_len": len(user_bytes),
        "photo_key": photo_key,
        "thumb_key": thumb_key,
        "description": "Faiz Khan - VIP Guest portrait",
        "faces": user_faces,
    })

    # 3. Step 3: Insert everything cleanly into Database
    print(f"\n💾 Saving {len(processed_items)} photos and embeddings to Database...")
    db = SessionLocal()
    try:
        # Clear previous photos for this event
        old_photos = db.query(Photo).filter(Photo.event_id == event_id).all()
        for p in old_photos:
            db.query(FaceEmbedding).filter(FaceEmbedding.photo_id == p.id).delete()
            db.delete(p)
        db.commit()

        total_faces_count = 0
        for item in processed_items:
            photo = Photo(
                id=uuid.uuid4(),
                event_id=event_id,
                filename=item["filename"],
                file_size_bytes=item["bytes_len"],
                storage_provider="supabase",
                storage_key=item["photo_key"],
                thumbnail_key=item["thumb_key"],
                scene_description=item["description"],
                processing_status="done",
                processed_at=datetime.now(timezone.utc),
            )
            db.add(photo)

            for face in item["faces"]:
                embedding = getattr(face, "embedding", None)
                if embedding is not None:
                    bbox = getattr(face, "bbox", None)
                    face_box = {
                        "x1": float(bbox[0]), "y1": float(bbox[1]),
                        "x2": float(bbox[2]), "y2": float(bbox[3])
                    } if bbox is not None else None

                    db.add(FaceEmbedding(
                        photo_id=photo.id,
                        embedding=np.asarray(embedding, dtype=np.float32).tolist(),
                        face_box=face_box,
                    ))
                    total_faces_count += 1

        db.commit()
        print(f"✅ Successfully saved {len(processed_items)} photos and {total_faces_count} face embeddings!")
    finally:
        db.close()

    print("\n" + "=" * 60)
    print("🎉 TEST EVENT SETUP COMPLETED SUCCESSFULLY!")
    print(f"Event Name:      {EVENT_NAME}")
    print(f"Event Slug/Code: {EVENT_SLUG}")
    print(f"Total Photos:    {len(processed_items)}")
    print(f"Live Guest URL:  https://events.novusgrid.io/event/{EVENT_SLUG}")
    print("=" * 60)

if __name__ == "__main__":
    main()
