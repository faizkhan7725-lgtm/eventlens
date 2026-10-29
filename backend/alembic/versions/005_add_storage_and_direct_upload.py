"""Add direct storage and photo upload fields.

Revision ID: 005
Revises: 004
Create Date: 2026-10-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Events table adjustments for direct upload support
    op.alter_column("events", "drive_folder_id", existing_type=sa.String(length=255), nullable=True)
    op.add_column(
        "events",
        sa.Column("source_type", sa.String(length=50), nullable=False, server_default="direct"),
    )

    # Photos table adjustments for local/S3 direct storage
    op.alter_column("photos", "drive_file_id", existing_type=sa.String(length=255), nullable=True)
    op.add_column(
        "photos",
        sa.Column("storage_provider", sa.String(length=50), nullable=False, server_default="drive"),
    )
    op.add_column(
        "photos",
        sa.Column("storage_key", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "photos",
        sa.Column("thumbnail_key", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "photos",
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("photos", "file_size_bytes")
    op.drop_column("photos", "thumbnail_key")
    op.drop_column("photos", "storage_key")
    op.drop_column("photos", "storage_provider")
    op.alter_column("photos", "drive_file_id", existing_type=sa.String(length=255), nullable=False)

    op.drop_column("events", "source_type")
    op.alter_column("events", "drive_folder_id", existing_type=sa.String(length=255), nullable=False)
