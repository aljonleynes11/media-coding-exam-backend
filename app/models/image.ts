import { DateTime } from 'luxon'
import { BaseModel, column, afterCreate } from '@adonisjs/lucid/orm'
import ImageObserverService from '#services/image_observer_service'

export default class Image extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'user_id' })
  declare userId: string

  @column()
  declare filename: string

  @column({ columnName: 'original_path' })
  declare originalPath: string

  @column({ columnName: 'thumbnail_path' })
  declare thumbnailPath: string

  @column.dateTime({ columnName: 'uploaded_at' })
  declare uploadedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @afterCreate()
  public static async analyzeAndPersistMetadata(image: Image) {
    setImmediate(() => {
      console.log('ImageObserverService.onImageCreated', image)
      ImageObserverService.onImageCreated({
        id: image.id,
        userId: image.userId,
        originalPath: image.originalPath,
      })
    })
  }
}
