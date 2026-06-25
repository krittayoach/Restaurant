import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from './index'
import path from 'path'

const migrationsFolder = path.join(import.meta.dir, '../../drizzle')

console.log('Running DB migrations...')
await migrate(db, { migrationsFolder })
console.log('Migrations complete ✅')
process.exit(0)
