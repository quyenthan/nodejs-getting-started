// Copyright 2017, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

const express = require('express');
//const bodyParser = require('body-parser');
const images = require('../lib/images');
const oauth2 = require('../lib/oauth2');

function getModel () {
  return require(`./model-${require('../config').get('DATA_BACKEND')}`);
}

const router = express.Router();

// Automatically parse request body as form data
//router.use(bodyParser.urlencoded({ extended: false }));
router.use(oauth2.template);

// Set Content-Type for all responses for these routes
router.use((req, res, next) => {
  res.set('Content-Type', 'text/html');
  next();
});

/**
 * GET /cameras
 *
 * Display a page of cameras (up to ten at a time).
 */
router.get('/', (req, res, next) => {
  getModel().list(10, req.query.pageToken, (err, entities, cursor) => {
    if (err) {
      next(err);
      return;
    }
    res.render('cameras/list.pug', {
      cameras: entities,
      nextPageToken: cursor
    });
  });
});

// [START mine]
// Use the oauth2.required middleware to ensure that only logged-in users
// can access this handler.
router.get('/mine', oauth2.required, (req, res, next) => {
  getModel().listBy(
    req.user.id,
    10,
    req.query.pageToken,
    (err, entities, cursor, apiResponse) => {
      if (err) {
        next(err);
        return;
      }
      res.render('cameras/list.pug', {
        cameras: entities,
        nextPageToken: cursor
      });
    }
  );
});
// [END mine]

/**
 * GET /cameras/add
 *
 * Display a form for creating a camera.
 */
// [START add_get]
router.get('/add', (req, res) => {
  res.render('cameras/form.pug', {
    camera: {},
    action: 'Add'
  });
});
// [END add_get]

/**
 * POST /cameras/add
 *
 * Create a camera.
 */
// [START add]
router.post(
  '/add',
  images.multer.single('image'),
  images.sendUploadToGCS,
  (req, res, next) => {
    let data = req.body;

    // If the user is logged in, set them as the creator of the camera.
    if (req.user) {
      data.createdBy = req.user.displayName;
      data.createdById = req.user.id;
    } else {
      data.createdBy = 'Anonymous';
    }

    // Was an image uploaded? If so, we'll use its public URL
    // in cloud storage.
    if (req.file && req.file.cloudStoragePublicUrl) {
      data.imageUrl = req.file.cloudStoragePublicUrl;
    }

    // Save the data to the database.
    getModel().create(data, (err, savedData) => {
      if (err) {
        next(err);
        return;
      }
      res.redirect(`${req.baseUrl}/${savedData.id}`);
    });
  }
);
// [END add]

/**
 * GET /cameras/:id/edit
 *
 * Display a camera for editing.
 */
router.get('/:camera/edit', (req, res, next) => {
  getModel().read(req.params.camera, (err, entity) => {
    if (err) {
      next(err);
      return;
    }
    res.render('cameras/form.pug', {
      camera: entity,
      action: 'Edit'
    });
  });
});

/**
 * POST /cameras/:id/edit
 *
 * Update a camera.
 */
router.post(
  '/:camera/edit',
  images.multer.single('image'),
  images.sendUploadToGCS,
  (req, res, next) => {
    let data = req.body;

    // Was an image uploaded? If so, we'll use its public URL
    // in cloud storage.
    console.log(req.file);
    if (req.file && req.file.cloudStoragePublicUrl) {
      req.body.imageUrl = req.file.cloudStoragePublicUrl;
    }

    getModel().update(req.params.camera, data, (err, savedData) => {
      if (err) {
        next(err);
        return;
      }
      res.redirect(`${req.baseUrl}/${savedData.id}`);
    });
  }
);

/**
 * GET /cameras/:id
 *
 * Display a camera.
 */
router.get('/:camera', (req, res, next) => {
  getModel().read(req.params.camera, (err, entity) => {
    if (err) {
      next(err);
      return;
    }
    res.render('cameras/view.pug', {
      camera: entity
    });
  });
});

/**
 * GET /cameras/:id/delete
 *
 * Delete a camera.
 */
router.get('/:camera/delete', (req, res, next) => {
  getModel().delete(req.params.camera, (err) => {
    if (err) {
      next(err);
      return;
    }
    res.redirect(req.baseUrl);
  });
});

/**
 * Errors on "/cameras/*" routes.
 */
router.use((err, req, res, next) => {
  // Format error and forward to generic error handler for logging and
  // responding to the request
  err.response = err.message;
  next(err);
});

module.exports = router;
