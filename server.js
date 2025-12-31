/**
 * Florix Technologies Backend
 * ---------------------------
 * A secure Express.js server hosted on Railway.
 * Handles email notifications and ML model proxying.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 4000; // Default to 4000 to avoid conflict with Next.js 3000

// =============================================================================
// MIDDLEWARE
// =============================================================================

const allowedOrigins = [
    'https://florixtechnologies.com',
    'https://www.florixtechnologies.com',
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['POST', 'GET'],
    credentials: true
}));

app.use(express.json());

// =============================================================================
// CONFIGURATION
// =============================================================================

if (!process.env.SENDGRID_API_KEY) {
    console.warn("WARNING: SENDGRID_API_KEY is missing in environment variables.");
} else {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// =============================================================================
// ROUTE: Health Check
// =============================================================================
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Florix Backend'
    });
});

// =============================================================================
// ROUTE: Contact / Quote Request
// =============================================================================
app.post('/contact', async (req, res) => {
    try {
        const { name, email, phone, message, service, serviceDetails } = req.body;

        if (!name || !email || !service) {
            return res.status(400).json({ error: 'Name, email, and service are required.' });
        }

        const fromEmail = process.env.CONTACT_FROM || 'info@florixtechnologies.com';
        const toEmail = process.env.CONTACT_TO || 'info@florixtechnologies.com';

        let detailsHtml = '';
        if (serviceDetails) {
            detailsHtml = `
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-top: 10px;">
            <h3 style="color: #333; margin-top: 0;">${service} Details:</h3>
            <ul style="list-style-type: none; padding: 0;">
                ${Object.entries(serviceDetails).map(([key, value]) => `
                    <li style="margin-bottom: 5px;">
                        <strong>${key.replace(/([A-Z])/g, ' $1').trim()}:</strong> ${value}
                    </li>
                `).join('')}
            </ul>
        </div>
        `;
        }

        const msg = {
            to: toEmail,
            from: fromEmail,
            subject: `New Quote Request: ${service} from ${name}`,
            text: `
        New Quote Request from Florix Technologies Website
        
        Service: ${service}
        Name: ${name}
        Email: ${email}
        Phone: ${phone || 'N/A'}
        
        Service Details:
        ${JSON.stringify(serviceDetails, null, 2)}
        
        Message:
        ${message || 'N/A'}
      `,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Quote Request</h2>
          <div style="margin-bottom: 20px;">
            <p><strong>Service Requested:</strong> <span style="font-size: 1.1em; color: #2563eb;">${service}</span></p>
          </div>
          <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; border-left: 4px solid #16a34a; margin-bottom: 20px;">
            <h3 style="color: #166534; margin-top: 0;">Contact Information</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
          </div>
          ${detailsHtml}
          <div style="margin-top: 20px;">
            <h3>Additional Message:</h3>
            <p style="background-color: #f3f4f6; padding: 15px; border-radius: 5px;">${message || 'No additional message provided.'}</p>
          </div>
        </div>
      `
        };

        await sgMail.send(msg);
        console.log(`Quote request email sent for ${email}`);
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Email Error:', error);
        res.status(500).json({
            error: 'Failed to send email.',
            details: error.response ? error.response.body : error.message
        });
    }
});

// =============================================================================
// ROUTE: Review Recommendation Email
// =============================================================================
app.post('/recommendation-email', async (req, res) => {
    try {
        const { formData, recommendations } = req.body;

        if (!formData || !recommendations) {
            return res.status(400).json({ error: 'Missing required data' });
        }

        const fromEmail = process.env.CONTACT_FROM || 'info@florixtechnologies.com';
        const toEmail = process.env.CONTACT_TO || 'info@florixtechnologies.com';

        const recommendationsHtml = recommendations.map((r) => `
            <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
                <h3 style="color: #2563eb; margin-top: 0;">${r.build_name} - ₹${r.estimated_price}</h3>
                <p><em>"${r.why_this_build}"</em></p>
                <ul style="font-size: 0.9em; line-height: 1.6;">
                    <li><strong>CPU:</strong> ${r.cpu}</li>
                    <li><strong>GPU:</strong> ${r.gpu}</li>
                    <li><strong>RAM:</strong> ${r.ram}</li>
                    <li><strong>Storage:</strong> ${r.storage}</li>
                    <li><strong>Motherboard:</strong> ${r.motherboard}</li>
                    <li><strong>PSU:</strong> ${r.psu}</li>
                    <li><strong>Cabinet:</strong> ${r.cabinet}</li>
                </ul>
            </div>
        `).join('');

        const msg = {
            to: toEmail,
            from: fromEmail,
            subject: `New PC Recommendation Generated for ${formData.name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">New PC Recommendation Generated</h2>
                    
                    <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; border-left: 4px solid #16a34a; margin-bottom: 20px;">
                        <h3 style="color: #166534; margin-top: 0;">User Contact Information</h3>
                        <p><strong>Name:</strong> ${formData.name}</p>
                        <p><strong>Email:</strong> <a href="mailto:${formData.email}">${formData.email}</a></p>
                        <p><strong>Phone:</strong> ${formData.phone}</p>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #333;">User Requirements</h3>
                        <ul style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; list-style-type: none;">
                            <li><strong>Usage:</strong> ${formData.usage}</li>
                            <li><strong>Budget:</strong> ${formData.budget}</li>
                            <li><strong>Speed Priority:</strong> ${formData.speed}</li>
                            <li><strong>Storage:</strong> ${formData.storageCapacity}</li>
                            <li><strong>Brands:</strong> ${formData.brands?.join(', ') || 'None'}</li>
                            <li><strong>Additional Notes:</strong> ${formData.additionalNotes || 'N/A'}</li>
                        </ul>
                    </div>

                    <div>
                        <h3 style="color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px;">Generated Recommendations</h3>
                        ${recommendationsHtml}
                    </div>
                </div>
            `,
        };

        await sgMail.send(msg);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('SendGrid Error:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// =============================================================================
// ROUTE: ML Model Proxy (PC Recommendations)
// =============================================================================
app.post('/predict', async (req, res) => {
    try {
        const inputData = req.body;

        // Default to the known Railway API if env var is missing, but prefer env var
        const mlApiUrl = process.env.ML_MODEL_API_URL || "https://web-production-49762.up.railway.app/recommend_direct";
        const mlApiKey = process.env.MODEL_API_KEY;

        const config = {
            headers: { 'Content-Type': 'application/json' }
        };

        // Only add Authorization if key exists
        if (mlApiKey) {
            config.headers['Authorization'] = `Bearer ${mlApiKey}`;
        }

        const response = await axios.post(mlApiUrl, inputData, config);
        res.status(200).json(response.data);

    } catch (error) {
        console.error('ML Proxy Error:', error.message);
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ error: 'Failed to communicate with prediction model.' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
});
