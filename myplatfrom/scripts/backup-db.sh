#!/bin/bash
# pg_dump → gzip → upload to S3-compatible storage (MinIO / R2 / AWS S3)
# Required env: DATABASE_URL, OBJECT_STORAGE_ENDPOINT, OBJECT_STORAGE_ACCESS_KEY,
#               OBJECT_STORAGE_SECRET_KEY, BACKUP_BUCKET (default: restaurant-backups)
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="restaurant_${TIMESTAMP}.sql.gz"
LOCAL_PATH="/tmp/${BACKUP_FILE}"
BUCKET="${BACKUP_BUCKET:-restaurant-backups}"

echo "📦 Dumping database..."
pg_dump "${DATABASE_URL}" | gzip > "${LOCAL_PATH}"
echo "   Size: $(du -sh "${LOCAL_PATH}" | cut -f1)"

echo "⬆️  Uploading to s3://${BUCKET}/postgres/${BACKUP_FILE}..."
AWS_ACCESS_KEY_ID="${OBJECT_STORAGE_ACCESS_KEY}" \
AWS_SECRET_ACCESS_KEY="${OBJECT_STORAGE_SECRET_KEY}" \
  aws s3 cp "${LOCAL_PATH}" "s3://${BUCKET}/postgres/${BACKUP_FILE}" \
    --endpoint-url "${OBJECT_STORAGE_ENDPOINT}" \
    --region "${OBJECT_STORAGE_REGION:-us-east-1}"

rm "${LOCAL_PATH}"
echo "✅ Backup complete: ${BACKUP_FILE}"
