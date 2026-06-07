import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
  region: process.env.OBJECT_STORAGE_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY!,
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY!,
  },
  forcePathStyle: true,
})

const BUCKET = process.env.OBJECT_STORAGE_BUCKET!

export async function uploadFile(key: string, buffer: ArrayBuffer, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: Buffer.from(buffer),
    ContentType: contentType,
  }))
}

export function getPublicUrl(key: string): string {
  return `${process.env.OBJECT_STORAGE_PUBLIC_URL}/${key}`
}

export async function getUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType })
  return getSignedUrl(s3, command, { expiresIn: 300 })
}

export async function getDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3, command, { expiresIn: 3600 })
}

export function menuImageKey(restaurantId: string, filename: string): string {
  return `menus/${restaurantId}/${Date.now()}_${filename}`
}

export function slipKey(restaurantId: string, orderId: string, filename: string): string {
  return `slips/${restaurantId}/${orderId}_${filename}`
}
