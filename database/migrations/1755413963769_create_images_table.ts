import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'images'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .uuid('user_id')
        .notNullable()
        .index()
        .references('id')
        .inTable('auth.users')
        .onDelete('CASCADE')

      table.string('filename', 255).notNullable()
      table.text('original_path').notNullable()
      table.text('thumbnail_path').notNullable()

      table.timestamp('uploaded_at', { useTz: true }).defaultTo(this.now())

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
