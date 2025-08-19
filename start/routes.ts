/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import AuthController from '#controllers/auth_controller'
import UploadsController from '#controllers/uploads_controller'
import { middleware } from '#start/kernel'
import ImagesController from '#controllers/images_controller'

router.get('/', async () => 'It works!')

router.group(() => {
  router.group(() => {
    router.post('/register', [AuthController, 'register'])
    router.post('/login', [AuthController, 'login'])
  }).prefix('/auth')

  router.group(() => {
    router.post('/uploads', [UploadsController, 'upload'])
    router.get('/images', [ImagesController, 'index'])
    router.get('/images/:id', [ImagesController, 'show'])
    router.get('/images/:id/signed-url', [ImagesController, 'signedUrl'])
    router.post('/images/:id/analyze-now', [ImagesController, 'analyzeNow'])
  })
    .use(middleware.auth())
}).prefix('/api')
