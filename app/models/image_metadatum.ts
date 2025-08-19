import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class ImageMetadatum extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'image_id' })
  declare imageId: number

  @column({ columnName: 'user_id' })
  declare userId: string

  @column()
  declare description: string | null

  @column()
  declare tags: string[] | null

  @column()
  declare colors: string[] | null

  @column({ columnName: 'ai_processing_status' })
  declare aiProcessingStatus: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
