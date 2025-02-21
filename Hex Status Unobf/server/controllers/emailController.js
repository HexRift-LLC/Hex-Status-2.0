import { emailService } from '../services/emailService';

export const emailController = {
  async handleContactForm(req, res) {
    try {
      await emailService.sendContactForm(req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send message' });
    }
  },

  async subscribeToAlerts(req, res) {
    try {
      // Add email to subscribers list
      // Send welcome email
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  }
};
