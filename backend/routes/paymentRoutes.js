import express from 'express';
import {
  createRegistrationIntent,
  confirmPayment,
  getMyPayments
} from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.post('/create-registration-intent', createRegistrationIntent);
router.post('/:id/confirm', confirmPayment);
router.get('/my', getMyPayments);

export default router;
