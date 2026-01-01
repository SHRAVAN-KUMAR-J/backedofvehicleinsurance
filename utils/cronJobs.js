const cron = require('node-cron');
const Vehicle = require('../models/Vehicle');
const Notification = require('../models/Notification');
const { createNotification, sendNotificationEmail } = require('./helpers');

const initializeActivationCron = () => {
  const activationCronTime = '*/5 * * * *';
  console.log(`🚀 Activation reminder cron job scheduled for: ${activationCronTime} (UTC)`);
  cron.schedule(activationCronTime, async () => {
    console.log('🤖 Running activation reminders check...');
    try {
      const now = new Date();
      console.log(`🔍 Activation check time: ${now} (UTC)`);
      
      const vehicles = await Vehicle.find({
        activationReminderScheduledAt: { $lte: now },
        activationReminderSent: false,
        startDate: { $ne: null },
        createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
      }).populate('ownerId');
      
      const filteredVehicles = vehicles.filter(v => v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active');
      console.log(`📅 Found ${filteredVehicles.length} vehicles eligible for activation reminder`);
      
      for (const vehicle of filteredVehicles) {
        const owner = vehicle.ownerId;
        const scheduledTime = new Date(vehicle.startDate.getTime() + 24 * 60 * 60 * 1000); // 1 day after startDate
        const timeSinceScheduled = now.getTime() - scheduledTime.getTime();
        
        // Skip if more than 1 day past the scheduled activation reminder time
        if (timeSinceScheduled > 24 * 60 * 60 * 1000) {
          console.log(`⏭️ Skipping past activation reminder for ${owner.email} (scheduled ${scheduledTime}, now ${now})`);
          vehicle.activationReminderSent = true;
          await vehicle.save();
          continue;
        }
        
        const existingNotification = await Notification.findOne({
          userId: owner._id,
          type: 'reminder',
          'metadata.reminderDays': 1,
          'metadata.startDate': vehicle.startDate,
          createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        });
        
        if (existingNotification) {
          console.log(`⏭️ Skipping duplicate activation reminder for ${owner.email} (already sent)`);
          vehicle.activationReminderSent = true;
          await vehicle.save();
          continue;
        }
        
        const notification = await createNotification({
          userId: owner._id,
          title: '1 Day Activation Reminder',
          message: `Your vehicle ${vehicle.registrationNumber} insurance is now active! Started on ${vehicle.startDate.toDateString()} and expires on ${vehicle.expiryDate.toDateString()}. Status: Good - Please note the renewal date for continuous coverage.`,
          type: 'reminder',
          metadata: {
            startDate: vehicle.startDate,
            expiryDate: vehicle.expiryDate,
            reminderDays: 1,
            postStart: true,
          },
        });
        
        try {
          await sendNotificationEmail({
            user: owner,
            notification,
            vehicle,
          });
          notification.emailSent = true;
          await notification.save();
          vehicle.activationReminderSent = true;
          await vehicle.save();
          console.log(`✅ Activation reminder sent to ${owner.email} for ${vehicle.registrationNumber} at ${now}`);
        } catch (emailError) {
          console.error(`❌ Failed to send activation email to ${owner.email}:`, emailError.message);
        }
      }
    } catch (error) {
      console.error('❌ Activation cron job error:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });
};

const initializeMonthReminder = () => {
  const monthReminderCronTime = '*/5 * * * *';
  console.log(`🚀 Month reminder cron job scheduled for: ${monthReminderCronTime} (UTC)`);
  cron.schedule(monthReminderCronTime, async () => {
    console.log('🤖 Running month reminder check...');
    try {
      const now = new Date();
      console.log(`🔍 Month reminder check time: ${now} (UTC)`);
      
      const vehicles = await Vehicle.find({
        monthReminderScheduledAt: { $lte: now },
        monthReminderSent: false,
        startDate: { $ne: null },
        createdAt: { $gte: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000) }
      }).populate('ownerId');
      
      const filteredVehicles = vehicles.filter(v => v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active');
      console.log(`📅 Found ${filteredVehicles.length} vehicles eligible for month reminder`);
      
      for (const vehicle of filteredVehicles) {
        const owner = vehicle.ownerId;
        const scheduledTime = new Date(vehicle.startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days after startDate
        const timeSinceScheduled = now.getTime() - scheduledTime.getTime();
        
        // Skip if more than 1 day past the scheduled month reminder time
        if (timeSinceScheduled > 24 * 60 * 60 * 1000) {
          console.log(`⏭️ Skipping past month reminder for ${owner.email} (scheduled ${scheduledTime}, now ${now})`);
          vehicle.monthReminderSent = true;
          await vehicle.save();
          continue;
        }
        
        const existingNotification = await Notification.findOne({
          userId: owner._id,
          type: 'reminder',
          'metadata.reminderDays': 30,
          'metadata.startDate': vehicle.startDate,
          createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        });
        
        if (existingNotification) {
          console.log(`⏭️ Skipping duplicate month reminder for ${owner.email} (already sent)`);
          vehicle.monthReminderSent = true;
          await vehicle.save();
          continue;
        }
        
        const notification = await createNotification({
          userId: owner._id,
          title: '1 Month Activation Reminder',
          message: `Your vehicle ${vehicle.registrationNumber} insurance has been active for one month now. Started on ${vehicle.startDate.toDateString()} and expires on ${vehicle.expiryDate.toDateString()}. Please ensure timely renewal.`,
          type: 'reminder',
          metadata: {
            startDate: vehicle.startDate,
            expiryDate: vehicle.expiryDate,
            reminderDays: 30,
            postStart: true,
          },
        });
        
        try {
          await sendNotificationEmail({
            user: owner,
            notification,
            vehicle,
          });
          notification.emailSent = true;
          await notification.save();
          vehicle.monthReminderSent = true;
          await vehicle.save();
          console.log(`✅ Month reminder sent to ${owner.email} for ${vehicle.registrationNumber} at ${now}`);
        } catch (emailError) {
          console.error(`❌ Failed to send month email to ${owner.email}:`, emailError.message);
        }
      }
    } catch (error) {
      console.error('❌ Month reminder cron job error:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });
};

const initializePreExpiryReminder = () => {
  const preExpiryCronTime = '*/5 * * * *';
  console.log(`🚀 Pre-expiry reminder cron job scheduled for: ${preExpiryCronTime} (UTC)`);
  cron.schedule(preExpiryCronTime, async () => {
    console.log('🤖 Running pre-expiry reminder check...');
    try {
      const now = new Date();
      console.log(`🔍 Pre-expiry check time: ${now} (UTC)`);
      
      const vehicles = await Vehicle.find({
        preExpiryReminderScheduledAt: { $lte: now },
        preExpiryReminderSent: false,
        expiryDate: { $ne: null }
      }).populate('ownerId');
      
      const filteredVehicles = vehicles.filter(v => v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active');
      console.log(`📅 Found ${filteredVehicles.length} vehicles eligible for pre-expiry reminder`);
      
      for (const vehicle of filteredVehicles) {
        const owner = vehicle.ownerId;
        const scheduledTime = new Date(vehicle.expiryDate.getTime() - 24 * 60 * 60 * 1000); // 1 day before expiryDate
        const timeSinceScheduled = now.getTime() - scheduledTime.getTime();
        
        // Skip if more than 1 day past the scheduled pre-expiry reminder time (e.g., already expired)
        if (timeSinceScheduled > 24 * 60 * 60 * 1000) {
          console.log(`⏭️ Skipping past pre-expiry reminder for ${owner.email} (scheduled ${scheduledTime}, now ${now})`);
          vehicle.preExpiryReminderSent = true;
          await vehicle.save();
          continue;
        }
        
        const existingNotification = await Notification.findOne({
          userId: owner._id,
          type: 'reminder',
          'metadata.reminderDays': -1,
          'metadata.expiryDate': vehicle.expiryDate,
          createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        });
        
        if (existingNotification) {
          console.log(`⏭️ Skipping duplicate pre-expiry reminder for ${owner.email} (already sent)`);
          vehicle.preExpiryReminderSent = true;
          await vehicle.save();
          continue;
        }
        
        const notification = await createNotification({
          userId: owner._id,
          title: '1 Day Before Expiry Reminder',
          message: `Your vehicle ${vehicle.registrationNumber} insurance expires tomorrow on ${vehicle.expiryDate.toDateString()}. Please renew immediately to avoid service interruptions and legal issues.`,
          type: 'reminder',
          metadata: {
            expiryDate: vehicle.expiryDate,
            reminderDays: -1,
            preExpiry: true,
          },
        });
        
        try {
          await sendNotificationEmail({
            user: owner,
            notification,
            vehicle,
          });
          notification.emailSent = true;
          await notification.save();
          vehicle.preExpiryReminderSent = true;
          await vehicle.save();
          console.log(`✅ Pre-expiry reminder sent to ${owner.email} for ${vehicle.registrationNumber} at ${now}`);
        } catch (emailError) {
          console.error(`❌ Failed to send pre-expiry email to ${owner.email}:`, emailError.message);
        }
      }
    } catch (error) {
      console.error('❌ Pre-expiry reminder cron job error:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });
};

const manualRunActivationReminders = async () => {
  console.log('🔄 Manual run of activation reminders...');
  try {
    const now = new Date();
    console.log(`🔍 Manual activation run at: ${now} (UTC)`);
    const vehicles = await Vehicle.find({
      activationReminderScheduledAt: { $lte: now },
      activationReminderSent: false,
      startDate: { $ne: null },
      createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
    }).populate('ownerId');
    const filteredVehicles = vehicles.filter(v => v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active');
    console.log(`📅 Manual: Found ${filteredVehicles.length} vehicles eligible for activation reminder`);
    let totalSent = 0;
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    for (const vehicle of filteredVehicles) {
      const owner = vehicle.ownerId;
      const scheduledTime = new Date(vehicle.startDate.getTime() + 24 * 60 * 60 * 1000); // 1 day after startDate
      const timeSinceScheduled = now.getTime() - scheduledTime.getTime();
      
      // Skip if more than 1 day past the scheduled activation reminder time
      if (timeSinceScheduled > 24 * 60 * 60 * 1000) {
        console.log(`⏭️ Manual: Skipping past activation reminder for ${owner.email} (scheduled ${scheduledTime}, now ${now})`);
        continue;
      }
      
      const existingNotification = await Notification.findOne({
        userId: owner._id,
        type: 'reminder',
        'metadata.reminderDays': 1,
        'metadata.startDate': vehicle.startDate,
        createdAt: { $gte: todayStart }
      });
      if (existingNotification) {
        console.log(`⏭️ Manual: Skipping duplicate activation reminder for ${owner.email} (already sent)`);
        continue;
      }
      const notification = await createNotification({
        userId: owner._id,
        title: '1 Day Activation Reminder (Manual)',
        message: `Your vehicle ${vehicle.registrationNumber} insurance is now active! Started on ${vehicle.startDate.toDateString()} and expires on ${vehicle.expiryDate.toDateString()}. Status: Good - Please note the renewal date for continuous coverage.`,
        type: 'reminder',
        metadata: {
          startDate: vehicle.startDate,
          expiryDate: vehicle.expiryDate,
          reminderDays: 1,
          postStart: true,
        },
      });
      try {
        await sendNotificationEmail({
          user: owner,
          notification,
          vehicle,
        });
        notification.emailSent = true;
        await notification.save();
        vehicle.activationReminderSent = true;
        await vehicle.save();
        totalSent++;
        console.log(`✅ Manual activation reminder sent to ${owner.email}`);
      } catch (emailError) {
        console.error(`❌ Manual activation email failed for ${owner.email}:`, emailError.message);
      }
    }
    console.log(`✅ Manual activation run completed. ${totalSent} reminders sent.`);
    return totalSent;
  } catch (error) {
    console.error('❌ Manual activation cron job error:', error);
    throw error;
  }
};

const manualRunMonthReminders = async () => {
  console.log('🔄 Manual run of month reminders...');
  try {
    const now = new Date();
    console.log(`🔍 Manual month run at: ${now} (UTC)`);
    const vehicles = await Vehicle.find({
      monthReminderScheduledAt: { $lte: now },
      monthReminderSent: false,
      startDate: { $ne: null },
      createdAt: { $gte: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000) }
    }).populate('ownerId');
    const filteredVehicles = vehicles.filter(v => v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active');
    console.log(`📅 Manual: Found ${filteredVehicles.length} vehicles eligible for month reminder`);
    let totalSent = 0;
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    for (const vehicle of filteredVehicles) {
      const owner = vehicle.ownerId;
      const scheduledTime = new Date(vehicle.startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days after startDate
      const timeSinceScheduled = now.getTime() - scheduledTime.getTime();
      
      // Skip if more than 1 day past the scheduled month reminder time
      if (timeSinceScheduled > 24 * 60 * 60 * 1000) {
        console.log(`⏭️ Manual: Skipping past month reminder for ${owner.email} (scheduled ${scheduledTime}, now ${now})`);
        continue;
      }
      
      const existingNotification = await Notification.findOne({
        userId: owner._id,
        type: 'reminder',
        'metadata.reminderDays': 30,
        'metadata.startDate': vehicle.startDate,
        createdAt: { $gte: todayStart }
      });
      if (existingNotification) {
        console.log(`⏭️ Manual: Skipping duplicate month reminder for ${owner.email} (already sent)`);
        continue;
      }
      const notification = await createNotification({
        userId: owner._id,
        title: '1 Month Activation Reminder (Manual)',
        message: `Your vehicle ${vehicle.registrationNumber} insurance has been active for one month now. Started on ${vehicle.startDate.toDateString()} and expires on ${vehicle.expiryDate.toDateString()}. Please ensure timely renewal.`,
        type: 'reminder',
        metadata: {
          startDate: vehicle.startDate,
          expiryDate: vehicle.expiryDate,
          reminderDays: 30,
          postStart: true,
        },
      });
      try {
        await sendNotificationEmail({
          user: owner,
          notification,
          vehicle,
        });
        notification.emailSent = true;
        await notification.save();
        vehicle.monthReminderSent = true;
        await vehicle.save();
        totalSent++;
        console.log(`✅ Manual month reminder sent to ${owner.email}`);
      } catch (emailError) {
        console.error(`❌ Manual month email failed for ${owner.email}:`, emailError.message);
      }
    }
    console.log(`✅ Manual month run completed. ${totalSent} reminders sent.`);
    return totalSent;
  } catch (error) {
    console.error('❌ Manual month cron job error:', error);
    throw error;
  }
};

const manualRunPreExpiryReminders = async () => {
  console.log('🔄 Manual run of pre-expiry reminders...');
  try {
    const now = new Date();
    console.log(`🔍 Manual pre-expiry run at: ${now} (UTC)`);
    const vehicles = await Vehicle.find({
      preExpiryReminderScheduledAt: { $lte: now },
      preExpiryReminderSent: false,
      expiryDate: { $ne: null }
    }).populate('ownerId');
    const filteredVehicles = vehicles.filter(v => v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active');
    console.log(`📅 Manual: Found ${filteredVehicles.length} vehicles eligible for pre-expiry reminder`);
    let totalSent = 0;
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    for (const vehicle of filteredVehicles) {
      const owner = vehicle.ownerId;
      const scheduledTime = new Date(vehicle.expiryDate.getTime() - 24 * 60 * 60 * 1000); // 1 day before expiryDate
      const timeSinceScheduled = now.getTime() - scheduledTime.getTime();
      
      // Skip if more than 1 day past the scheduled pre-expiry reminder time
      if (timeSinceScheduled > 24 * 60 * 60 * 1000) {
        console.log(`⏭️ Manual: Skipping past pre-expiry reminder for ${owner.email} (scheduled ${scheduledTime}, now ${now})`);
        continue;
      }
      
      const existingNotification = await Notification.findOne({
        userId: owner._id,
        type: 'reminder',
        'metadata.reminderDays': -1,
        'metadata.expiryDate': vehicle.expiryDate,
        createdAt: { $gte: todayStart }
      });
      if (existingNotification) {
        console.log(`⏭️ Manual: Skipping duplicate pre-expiry reminder for ${owner.email} (already sent)`);
        continue;
      }
      const notification = await createNotification({
        userId: owner._id,
        title: '1 Day Before Expiry Reminder (Manual)',
        message: `Your vehicle ${vehicle.registrationNumber} insurance expires tomorrow on ${vehicle.expiryDate.toDateString()}. Please renew immediately to avoid service interruptions and legal issues.`,
        type: 'reminder',
        metadata: {
          expiryDate: vehicle.expiryDate,
          reminderDays: -1,
          preExpiry: true,
        },
      });
      try {
        await sendNotificationEmail({
          user: owner,
          notification,
          vehicle,
        });
        notification.emailSent = true;
        await notification.save();
        vehicle.preExpiryReminderSent = true;
        await vehicle.save();
        totalSent++;
        console.log(`✅ Manual pre-expiry reminder sent to ${owner.email}`);
      } catch (emailError) {
        console.error(`❌ Manual pre-expiry email failed for ${owner.email}:`, emailError.message);
      }
    }
    console.log(`✅ Manual pre-expiry run completed. ${totalSent} reminders sent.`);
    return totalSent;
  } catch (error) {
    console.error('❌ Manual pre-expiry cron job error:', error);
    throw error;
  }
};

module.exports = {
  initializeActivationCron,
  initializeMonthReminder,
  initializePreExpiryReminder,
  manualRunActivationReminders,
  manualRunMonthReminders,
  manualRunPreExpiryReminders,
};
