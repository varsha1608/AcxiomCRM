const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  unlockUser,
  adminResetPassword,
  getAssignableUsers
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/assignable', getAssignableUsers);

// Admin-only endpoints
router.route('/')
  .get(authorize('Admin'), getUsers)
  .post(authorize('Admin'), createUser);

router.route('/:id')
  .get(authorize('Admin'), getUserById)
  .put(authorize('Admin'), updateUser);

router.post('/:id/unlock', authorize('Admin'), unlockUser);
router.post('/:id/reset-password', authorize('Admin'), adminResetPassword);

module.exports = router;
