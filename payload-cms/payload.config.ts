import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { r2Storage } from '@payloadcms/storage-r2'
import { buildConfig } from 'payload'

import { Articles } from './src/collections/Articles'
import { Media } from './src/collections/Media'
import { Products } from './src/collections/Products'
import { Users } from './src/collections/Users'

const runtimeEnv = ((globalThis as unknown as { cloudflare?: { env?: Record<string, unknown> } }).cloudflare?.env || {}) as {
  D1?: D1Database
  R2?: R2Bucket
  PAYLOAD_SECRET?: string
}

export default buildConfig({
  secret: runtimeEnv.PAYLOAD_SECRET || 'dev-payload-secret-change-before-production',
  admin: {
    user: Users.slug,
  },
  editor: lexicalEditor({}),
  collections: [Users, Media, Articles, Products],
  db: sqliteD1Adapter({
    binding: runtimeEnv.D1 as D1Database,
    push: false,
  }),
  plugins: [
    r2Storage({
      bucket: runtimeEnv.R2 as R2Bucket,
      collections: {
        media: true,
      },
    }),
  ],
  typescript: {
    outputFile: './payload-types.ts',
  },
})
