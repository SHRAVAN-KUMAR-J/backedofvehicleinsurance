const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((err, success) => {
  if (err) {
    console.error('Email transporter verification failed:', err);
  } else {
    console.log('Email transporter ready');
  }
});

const sendOTP = async (email, otp, purpose) => {
  try {
    const subject = `${purpose} OTP for Vehicle Insurance System`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #3498db;">${purpose} OTP</h2>
          <p style="color: #34495e;">Dear User,</p>
          <p>Your One-Time Password (OTP) for ${purpose.toLowerCase()} is: <strong>${otp}</strong></p>
          <p>This OTP is valid for 10 minutes. Please do not share it with anyone.</p>
          <p><a href="${process.env.FRONTEND_URL}" style="color: #3498db;">Login to your portal</a></p>
          <img src="https://www.shutterstock.com/image-vector/car-insurance-policy-finance-form-600nw-1779897377.jpg" alt="Car Insurance" style="max-width: 100%; height: auto; margin-top: 20px;">
        </div>
        <div style="text-align: center; color: #7f8c8d; font-size: 12px; margin-top: 30px;">
          <p>&copy; 2025 Vehicle Insurance System. All rights reserved.</p>
        </div>
      </div>
    `;
    const mailOptions = {
      from: `"Vehicle Insurance System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html: htmlContent,
    };
    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}`);
  } catch (error) {
    console.error(`Error sending OTP email to ${email}:`, error);
    throw new Error('Failed to send OTP email');
  }
};

const sendRegistrationSuccess = async (email, user) => {
  try {
    const subject = 'Welcome to Vehicle Insurance System - Registration Successful';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #27ae60;">Registration Successful!</h2>
          <p style="color: #34495e;">Dear ${user.name},</p>
          <p>Welcome to the Vehicle Insurance System! Your account has been successfully created and verified.</p>
          <p>You can now log in using your email and password to manage your vehicle insurance and services.</p>
          <p><a href="${process.env.FRONTEND_URL}" style="color: #3498db;">Login to your portal</a></p>
          <img src="https://www.shutterstock.com/image-vector/car-insurance-policy-finance-form-600nw-1779897377.jpg" alt="Car Insurance" style="max-width: 100%; height: auto; margin-top: 20px;">
        </div>
        <div style="text-align: center; color: #7f8c8d; font-size: 12px; margin-top: 30px;">
          <p>&copy; 2025 Vehicle Insurance System. All rights reserved.</p>
        </div>
      </div>
    `;
    const mailOptions = {
      from: `"Vehicle Insurance System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html: htmlContent,
    };
    await transporter.sendMail(mailOptions);
    console.log(`Registration success email sent to ${email}`);
  } catch (error) {
    console.error(`Error sending registration success email to ${email}:`, error);
    throw new Error('Failed to send registration success email');
  }
};

const sendLoginSuccess = async (email, user) => {
  try {
    const subject = 'Login Successful - Vehicle Insurance System';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #27ae60;">Login Successful!</h2>
          <p style="color: #34495e;">Dear ${user.name},</p>
          <p>You have successfully logged in to your Vehicle Insurance System account.</p>
          <p>If you did not log in, please contact support immediately.</p>
          <p><a href="${process.env.FRONTEND_URL}" style="color: #3498db;">Access your portal</a></p>
          <img src="https://www.shutterstock.com/image-vector/car-insurance-policy-finance-form-600nw-1779897377.jpg" alt="Car Insurance" style="max-width: 100%; height: auto; margin-top: 20px;">
        </div>
        <div style="text-align: center; color: #7f8c8d; font-size: 12px; margin-top: 30px;">
          <p>&copy; 2025 Vehicle Insurance System. All rights reserved.</p>
        </div>
      </div>
    `;
    const mailOptions = {
      from: `"Vehicle Insurance System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html: htmlContent,
    };
    await transporter.sendMail(mailOptions);
    console.log(`Login success email sent to ${email}`);
  } catch (error) {
    console.error(`Error sending login success email to ${email}:`, error);
    throw new Error('Failed to send login success email');
  }
};

const sendNotificationEmail = async ({ user, notification, vehicle = null, insurance = null }) => {
  try {
    let subject = notification.title;
    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
    `;

    // Insurance Amount Set/Updated
    if (notification.type === 'update' && notification.metadata?.amount && vehicle) {
      subject = `Insurance Amount ${notification.metadata.amount ? 'Set' : 'Updated'} - ${vehicle.registrationNumber}`;
      htmlContent += `
        <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin-bottom: 20px;">
          <h3 style="color: #1976d2; margin-top: 0;">💰 Insurance Amount Notification</h3>
        </div>
        <p style="color: #34495e;">Dear ${user.name},</p>
        <p>${notification.message}</p>
        <div style="background: white; border: 2px solid #4caf50; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h4 style="color: #2e7d32; margin-top: 0;">Vehicle Details</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Vehicle:</td>
              <td style="padding: 8px 0; color: #333;">${vehicle.model}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Registration No:</td>
              <td style="padding: 8px 0; color: #333;">${vehicle.registrationNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Insurance Amount:</td>
              <td style="padding: 8px 0; color: #2e7d32; font-size: 20px; font-weight: bold;">₹${notification.metadata.amount.toLocaleString()}</td>
            </tr>
            ${notification.metadata.startDate ? `
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Start Date:</td>
              <td style="padding: 8px 0; color: #333;">${new Date(notification.metadata.startDate).toDateString()}</td>
            </tr>` : ''}
            ${notification.metadata.expiryDate ? `
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Expiry Date:</td>
              <td style="padding: 8px 0; color: #333;">${new Date(notification.metadata.expiryDate).toDateString()}</td>
            </tr>` : ''}
          </table>
        </div>
        <p style="background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
          <strong>Action Required:</strong> Please log in to your portal to complete the payment.
        </p>
        <p><a href="${process.env.FRONTEND_URL}" style="background: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Pay Insurance Now</a></p>
      `;
    }
    // Payment Success for Customer
    else if (notification.type === 'success' && notification.metadata?.paymentId && user.role === 'customer') {
      subject = `✅ Payment Successful - ${notification.metadata.registrationNumber}`;
      htmlContent += `
        <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin-bottom: 20px;">
          <h3 style="color: #2e7d32; margin-top: 0;">✅ Payment Completed Successfully!</h3>
        </div>
        <p style="color: #34495e;">Dear ${user.name},</p>
        <p>Your insurance payment has been successfully processed! Thank you for choosing our services.</p>
        <div style="background: white; border: 2px solid #4caf50; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h4 style="color: #2e7d32; margin-top: 0;">Payment Summary</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Vehicle:</td>
              <td style="padding: 8px 0; color: #333;">${notification.metadata.model}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Registration No:</td>
              <td style="padding: 8px 0; color: #333;">${notification.metadata.registrationNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Amount Paid:</td>
              <td style="padding: 8px 0; color: #2e7d32; font-size: 20px; font-weight: bold;">₹${notification.metadata.amount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Payment ID:</td>
              <td style="padding: 8px 0; color: #333; font-family: monospace;">${notification.metadata.paymentId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Payment Date:</td>
              <td style="padding: 8px 0; color: #333;">${new Date().toDateString()}</td>
            </tr>
          </table>
        </div>
        <p style="background: #e3f2fd; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
          <strong>Next Steps:</strong> Your insurance is now active. You can view and download your policy documents from your portal.
        </p>
        <p><a href="${process.env.FRONTEND_URL}" style="background: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">View Policy Details</a></p>
      `;
    }
    // Payment Success for Staff
    else if (notification.type === 'success' && notification.metadata?.paymentId && notification.metadata?.customerName) {
      subject = `💰 Payment Received from ${notification.metadata.customerName}`;
      htmlContent += `
        <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin-bottom: 20px;">
          <h3 style="color: #2e7d32; margin-top: 0;">💰 New Payment Received</h3>
        </div>
        <p style="color: #34495e;">Dear Staff Member,</p>
        <p>${notification.message}</p>
        <div style="background: white; border: 2px solid #4caf50; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h4 style="color: #2e7d32; margin-top: 0;">Payment Details</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Customer Name:</td>
              <td style="padding: 8px 0; color: #333;">${notification.metadata.customerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Vehicle:</td>
              <td style="padding: 8px 0; color: #333;">${notification.metadata.model}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Registration No:</td>
              <td style="padding: 8px 0; color: #333;">${notification.metadata.registrationNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Amount Received:</td>
              <td style="padding: 8px 0; color: #2e7d32; font-size: 20px; font-weight: bold;">₹${notification.metadata.amount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Payment ID:</td>
              <td style="padding: 8px 0; color: #333; font-family: monospace;">${notification.metadata.paymentId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: bold;">Payment Date:</td>
              <td style="padding: 8px 0; color: #333;">${new Date().toDateString()}</td>
            </tr>
          </table>
        </div>
        <p style="background: #e3f2fd; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
          <strong>Action Required:</strong> Please process the insurance policy and upload relevant documents.
        </p>
        <p><a href="${process.env.FRONTEND_URL}" style="background: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">View Customer Details</a></p>
      `;
    }
    // Insurance Approval
    else if (notification.type === 'approval' && vehicle && insurance) {
      subject = 'Insurance Payment Approval Notification';
      htmlContent += `
        <h3 style="color: #3498db;">${notification.title}</h3>
        <p style="color: #34495e;">Dear ${user.name},</p>
        <p>Your insurance payment for vehicle <strong>${vehicle.registrationNumber}</strong> (Insurance ID: ${insurance._id}) has been approved.</p>
        <p>You can now download the PDF document from your portal.</p>
      `;
    }
    // Reminder notifications
    else if (notification.type === 'reminder' && vehicle) {
      const isPostExpiry = notification.metadata?.postExpiry || notification.metadata?.reminderDays === -1;
      const isPostStart = notification.metadata?.postStart || notification.metadata?.reminderDays === 1;
      const expiryDate = notification.metadata?.expiryDate ? new Date(notification.metadata.expiryDate) : vehicle.expiryDate;
      
      if (isPostExpiry) {
        subject = `⚠️ URGENT: Insurance is about to Expire - ${vehicle.registrationNumber}`;
        htmlContent += `
          <div style="background: #fee; border-left: 4px solid #e74c3c; padding: 15px; margin-bottom: 20px;">
            <h3 style="color: #e74c3c; margin-top: 0;">⚠️ Insurance Expired - Immediate Action Required</h3>
          </div>
          <p style="color: #34495e;">Dear ${user.name},</p>
          <p><strong style="color: #e74c3c;">Your vehicle insurance will be EXPIRED!</strong></p>
          <p>Vehicle: <strong>${vehicle.registrationNumber}</strong></p>
          <p>Expiry Date: <strong>${expiryDate.toDateString()}</strong></p>
          <p style="background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
            <strong>Important:</strong> Driving without valid insurance is illegal and may result in fines, penalties, and legal consequences. Please renew your insurance immediately.
          </p>
          <p>Please visit our portal to renew your insurance as soon as possible.</p>
          <p><a href="${process.env.FRONTEND_URL}" style="background: #b91402ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Renew Insurance Now</a></p>
        `;
      } else if (isPostStart) {
        subject = `⏰ Reminder Activated Started Your Vehicle - ${vehicle.registrationNumber}`;
        const vehicleStartDate = vehicle.startDate ? new Date(vehicle.startDate) : (notification.metadata?.startDate ? new Date(notification.metadata.startDate) : null);
        htmlContent += `
          <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin-bottom: 20px;">
            <h3 style="color: #2e7d32; margin-top: 0;">🔔 Insurance Reminder Activation Confirmation</h3>
          </div>
          <p style="color: #34495e;">Dear ${user.name},</p>
          <p>Your vehicle <strong>${vehicle.model}</strong> (Registration No: <strong>${vehicle.registrationNumber}</strong>) insurance is now active and in good standing!</p>
          <p><strong>Started on:</strong> ${vehicleStartDate ? vehicleStartDate.toDateString() : 'N/A'}</p>
          <p style="color: #e74c3c; font-weight: bold;">Expires on: ${expiryDate.toDateString()}</p>
          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; color: #856404;">
            <strong>Status: Good - One day has passed since activation!</strong> Please note the renewal date for continuous coverage next year.
          </div>
          <p><a href="${process.env.FRONTEND_URL}" style="background: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">View Insurance Details</a></p>
        `;
      } else {
        subject = `Insurance Renewal Reminder - ${vehicle.registrationNumber}`;
        htmlContent += `
          <h3 style="color: #3498db;">${notification.title}</h3>
          <p style="color: #34495e;">Dear ${user.name},</p>
          <p>Your vehicle <strong>${vehicle.registrationNumber}</strong> insurance expires on <strong>${expiryDate.toDateString()}</strong>.</p>
          <p>${notification.message}</p>
          <p><a href="${process.env.FRONTEND_URL}" style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Renew Insurance</a></p>
        `;
      }
    }
    // Generic update notifications
    else if (notification.type === 'update' && vehicle) {
      subject = `Insurance Update - ${vehicle.registrationNumber}`;
      const expiryDate = notification.metadata?.expiryDate ? new Date(notification.metadata.expiryDate) : vehicle.expiryDate;
      htmlContent += `
        <h3 style="color: #3498db;">${notification.title}</h3>
        <p style="color: #34495e;">Dear ${user.name},</p>
        <p>${notification.message}</p>
        ${expiryDate ? `<p>New expiry date: <strong>${expiryDate.toDateString()}</strong></p>` : ''}
        <p>Please keep this information for your records.</p>
      `;
    }
    // Default notification
    else {
      subject = notification.title;
      htmlContent += `
        <h3 style="color: #3498db;">${notification.title}</h3>
        <p style="color: #34495e;">Dear ${user.name},</p>
        <p>${notification.message}</p>
      `;
    }
    htmlContent += `
          <img src="https://www.shutterstock.com/image-vector/car-insurance-policy-finance-form-600nw-1779897377.jpg" alt="Car Insurance" style="max-width: 100%; height: auto; margin-top: 20px;">
        </div>
        <div style="text-align: center; color: #7f8c8d; font-size: 12px; margin-top: 30px;">
          <p><a href="${process.env.FRONTEND_URL}" style="color: #3498db;">Login to your portal</a></p>
          <p>&copy; 2025 Vehicle Insurance System. All rights reserved.</p>
        </div>
      </div>
    `;
    const mailOptions = {
      from: `"Vehicle Insurance System" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject,
      html: htmlContent,
    };
    await transporter.sendMail(mailOptions);
    console.log(`Notification email sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error(`Error sending notification email to ${user.email}:`, error);
    throw new Error('Failed to send notification email');
  }
};

module.exports = {
  sendOTP,
  sendRegistrationSuccess,
  sendLoginSuccess,
  sendNotificationEmail,
};
