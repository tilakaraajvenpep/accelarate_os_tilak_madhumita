import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { readFileSync } from 'fs'
import path from 'path'
import * as schema from '../models'

const connectionString = process.env.DATABASE_URL
const isRds = connectionString?.includes('rds.amazonaws.com')

const pool = new Pool({
  connectionString,
  ssl: isRds
    ? { ca: readFileSync(path.join(__dirname, '../../certs/rds-combined-ca-bundle.pem'), 'utf8') }
    : undefined,
})

export const db = drizzle(pool, { schema })
