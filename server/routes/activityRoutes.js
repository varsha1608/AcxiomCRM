const express = require('express');
const router = express.Router();
const {
  getActivities,
  getActivityById,
  createActivity,
  deleteActivity
} = require('../controllers/activityController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .get(getActivities)
  .post(createActivity);

router.route('/:id')
  .get(getActivityById)
  .delete(deleteActivity);

module.exports = router;
