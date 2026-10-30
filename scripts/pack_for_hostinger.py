import os
import sys
import zipfile
import shutil
from pathlib import Path

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding="utf-8")

def package():
    base_dir = Path(__file__).resolve().parent.parent
    frontend_dir = base_dir / "frontend"
    dist_dir = base_dir / "dist"
    dist_dir.mkdir(exist_ok=True)
    zip_path = dist_dir / "eventlens-express-deploy.zip"

    if zip_path.exists():
        zip_path.unlink()

    # Ensure .env.production exists
    env_prod = frontend_dir / ".env.production"
    if not env_prod.exists():
        env_prod.write_text(
            "PORT=3000\n"
            "NODE_ENV=production\n"
            "NEXT_PUBLIC_APP_NAME=EventLens\n"
            "NEXT_PUBLIC_API_URL=https://eventlens-api.onrender.com\n"
            "NEXT_PUBLIC_SITE_URL=https://events.novusgrid.io\n",
            encoding="utf-8"
        )

    print(f"📦 Packaging Hostinger Express deployment archive...")
    files_to_pack = [
        "server.js",
        "package.json",
        "package-lock.json",
        "next.config.mjs",
        "tsconfig.json",
        "tailwind.config.ts",
        "postcss.config.mjs",
        ".env.production",
    ]

    dirs_to_pack = [
        "public",
        ".next",
        "src",
    ]

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # Pack single files
        for fname in files_to_pack:
            fpath = frontend_dir / fname
            if fpath.exists():
                zinfo = zipfile.ZipInfo(fname)
                zinfo.external_attr = (0o644 << 16)
                with open(fpath, "rb") as f:
                    zf.writestr(zinfo, f.read())
                print(f"  + Added file: {fname}")
            else:
                print(f"  ! Warning: {fname} does not exist")

        # Pack directories
        for dname in dirs_to_pack:
            dpath = frontend_dir / dname
            if not dpath.exists():
                print(f"  ! Warning: directory {dname} does not exist")
                continue

            for root, dirs, files in os.walk(dpath):
                # Skip .next/cache
                if "cache" in root.replace("\\", "/").split("/"):
                    continue

                rel_root = os.path.relpath(root, frontend_dir).replace("\\", "/")
                # Directory entry
                dir_zinfo = zipfile.ZipInfo(rel_root + "/")
                dir_zinfo.external_attr = (0o755 << 16) | 0o040000
                zf.writestr(dir_zinfo, "")

                for f in files:
                    file_full = Path(root) / f
                    rel_file = os.path.relpath(file_full, frontend_dir).replace("\\", "/")
                    file_zinfo = zipfile.ZipInfo(rel_file)
                    file_zinfo.external_attr = (0o644 << 16)
                    with open(file_full, "rb") as fp:
                        zf.writestr(file_zinfo, fp.read())

    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"✅ Archive created successfully: {zip_path} ({size_mb:.2f} MB)")

if __name__ == "__main__":
    package()
