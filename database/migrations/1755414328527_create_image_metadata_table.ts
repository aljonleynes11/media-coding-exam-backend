import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'image_metadata'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('image_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('images')
        .onDelete('CASCADE')

      table
        .uuid('user_id')
        .notNullable()
        .index()
        .references('id')
        .inTable('auth.users')
        .onDelete('CASCADE')

      table.text('description')
      table.specificType('tags', 'text[]')
      table.specificType('colors', 'varchar(7)[]')
      table.string('ai_processing_status', 20)

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
