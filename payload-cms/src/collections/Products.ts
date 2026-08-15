import type { CollectionConfig } from 'payload'

export const Products: CollectionConfig = {
  slug: 'products',
  access: {
    read: () => true,
  },
  admin: {
    defaultColumns: ['name', 'sku', 'status', 'allowCheckout', 'inventory', 'updatedAt'],
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'sku',
      type: 'text',
      index: true,
    },
    {
      name: 'excerpt',
      type: 'textarea',
    },
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'category',
      type: 'text',
      defaultValue: 'Fasteners',
    },
    {
      name: 'material',
      type: 'text',
    },
    {
      name: 'size',
      type: 'text',
    },
    {
      name: 'specs',
      type: 'textarea',
      admin: {
        description: 'Standards, finish, thread pitch, drawings, or other technical notes.',
      },
    },
    {
      name: 'packageInfo',
      type: 'text',
      admin: {
        description: 'Example: Standard export carton, custom packaging available.',
      },
    },
    {
      name: 'leadTime',
      type: 'text',
      admin: {
        description: 'Example: 7-14 business days, urgent orders by confirmation.',
      },
    },
    {
      name: 'shippingNote',
      type: 'textarea',
      admin: {
        description: 'Freight, duties, import taxes, and destination-specific notes.',
      },
    },
    {
      name: 'moq',
      type: 'number',
      defaultValue: 1,
      min: 1,
    },
    {
      name: 'weightGrams',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'images',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    {
      name: 'priceCents',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'JPY',
      maxLength: 3,
    },
    {
      name: 'inventory',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
    {
      name: 'allowCheckout',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}
