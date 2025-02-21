import sgMail from '@sendgrid/mail';
import config from '../config';

sgMail.setApiKey(config.sendgrid.apiKey);

export const emailService = {
  async sendContactForm(data) {
    const msg = {
      to: config.admin.email,
      from: {
        email: config.sendgrid.from.email,
        name: config.sendgrid.from.name
      },
      templateId: config.sendgrid.templates.contactForm,
      dynamicTemplateData: {
        name: data.name,
        email: data.email,
        message: data.message
      }
    };
    return sgMail.send(msg);
  },

  async sendStatusAlert(subscribers, statusData) {
    const messages = subscribers.map(subscriber => ({
      to: subscriber.email,
      from: {
        email: config.sendgrid.from.email,
        name: config.sendgrid.from.name
      },
      templateId: config.sendgrid.templates.statusAlert,
      dynamicTemplateData: {
        serviceName: statusData.service,
        status: statusData.status,
        timestamp: statusData.timestamp
      }
    }));

    // Send in batches to respect rate limits
    for (let i = 0; i < messages.length; i += config.sendgrid.settings.batchSize) {
      const batch = messages.slice(i, i + config.sendgrid.settings.batchSize);
      await sgMail.send(batch);
    }
  }
};
