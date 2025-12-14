const cron = require('node-cron');
const Vehicle = require('../models/Vehicle');
const Notification = require('../models/Notification');
const { createNotification, sendNotificationEmail } = require('./helpers');

const initializeCronJobs = () => {
  const cronTime = process.env.CRON_TIME || '0 3 * * *'; // Default to daily at 3 AM
  console.log(`🚀 Cron job scheduled for: ${cronTime}`);

  cron.schedule(cronTime, async () => {
    console.log('🤖 Running daily insurance renewal reminders...');

    try {
      const now = new Date();
      console.log(`🔍 Current time: ${now}`);
      console.log(`🔍 Timezone: Asia/Kolkata`);

      // Define reminder dates including post-expiry and 364-day reminder
      const reminderDates = [
        { days: 365, label: '364 Day Reminder', type: 'post-start' },
        { days: 30, label: '30 Day Reminder', type: 'pre-expiry' },
        { days: 7, label: '7 Day Reminder', type: 'pre-expiry' },
        { days: 1, label: '1 Day Reminder', type: 'pre-expiry' },
        { days: -1, label: 'Post-Expiry Reminder', type: 'post-expiry' },
      ];

      for (const reminder of reminderDates) {
        // Define the start and end of the current day for notification checks
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(todayStart);
        todayEnd.setHours(23, 59, 59, 999);

        if (reminder.type === 'post-expiry') {
          // Handle post-expiry reminders (1 day after expiry date)
          const startOfDay = new Date(now);
          startOfDay.setDate(startOfDay.getDate() - 1);
          startOfDay.setHours(0, 0, 0, 0);

          const endOfDay = new Date(startOfDay);
          endOfDay.setHours(23, 59, 59, 999);

          console.log(`🔍 Post-expiry: Looking for expiry dates between ${startOfDay} and ${endOfDay}`);

          const vehicles = await Vehicle.find({
            expiryDate: {
              $gte: startOfDay,
              $lte: endOfDay,
              $ne: null
            }
          }).populate('ownerId');

          const filteredVehicles = vehicles.filter(v =>
            v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active'
          );
          console.log(`📅 Found ${filteredVehicles.length} vehicles for ${reminder.label}`);

          for (const vehicle of filteredVehicles) {
            const owner = vehicle.ownerId;

            // Check for existing notification for this vehicle and reminder type
            const existingNotification = await Notification.findOne({
              userId: owner._id,
              type: 'reminder',
              'metadata.expiryDate': vehicle.expiryDate,
              'metadata.reminderDays': -1,
              createdAt: { $gte: todayStart }
            });

            if (existingNotification) {
              console.log(`⏭️ Skipping duplicate post-expiry reminder for ${owner.email} (already sent)`);
              continue;
            }

            const notification = await createNotification({
              userId: owner._id,
              title: `${reminder.label} - Insurance Expired`,
              message: `Your vehicle ${vehicle.registrationNumber} insurance has expired on ${vehicle.expiryDate.toDateString()}. Please renew immediately to avoid service interruptions and legal issues.`,
              type: 'reminder',
              metadata: {
                expiryDate: vehicle.expiryDate,
                reminderDays: -1,
                postExpiry: true,
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
              console.log(`✅ Post-expiry reminder sent to ${owner.email} for ${vehicle.registrationNumber}`);
            } catch (emailError) {
              console.error(`❌ Failed to send post-expiry email to ${owner.email}:`, emailError.message);
            }
          }
        } else if (reminder.type === 'post-start') {
          // Handle 364-day reminder (1 day after insurance start date)
          const startOfDay = new Date(now);
          startOfDay.setDate(startOfDay.getDate() - 1);
          startOfDay.setHours(0, 0, 0, 0);

          const endOfDay = new Date(startOfDay);
          endOfDay.setHours(23, 59, 59, 999);

          console.log(`🔍 364-Day Reminder: Looking for start dates between ${startOfDay} and ${endOfDay}`);

          const vehicles = await Vehicle.find({
            startDate: {
              $gte: startOfDay,
              $lte: endOfDay,
              $ne: null
            },
            expiryDate: { $ne: null }
          }).populate('ownerId');

          const filteredVehicles = vehicles.filter(v =>
            v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active'
          );

          console.log(`📅 Found ${filteredVehicles.length} vehicles for ${reminder.label}`);
          filteredVehicles.forEach(vehicle => {
            console.log(`   - ${vehicle.registrationNumber}: Start=${vehicle.startDate}, Expiry=${vehicle.expiryDate}`);
          });

          for (const vehicle of filteredVehicles) {
            const owner = vehicle.ownerId;

            // Check for existing notification for this vehicle and reminder type
            const existingNotification = await Notification.findOne({
              userId: owner._id,
              type: 'reminder',
              'metadata.reminderDays': 365,
              'metadata.startDate': vehicle.startDate,
              createdAt: { $gte: todayStart }
            });

            if (existingNotification) {
              console.log(`⏭️ Skipping duplicate 364-day reminder for ${owner.email} (already sent)`);
              continue;
            }

            const notification = await createNotification({
              userId: owner._id,
              title: `${reminder.label} - Insurance Started`,
              message: `Your vehicle ${vehicle.registrationNumber} insurance started on ${vehicle.startDate.toDateString()} and will expire on ${vehicle.expiryDate.toDateString()}. Please note this renewal date to ensure continuous coverage next year.`,
              type: 'reminder',
              metadata: {
                startDate: vehicle.startDate,
                expiryDate: vehicle.expiryDate,
                reminderDays: 365,
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
              console.log(`✅ 364-day reminder sent to ${owner.email} for ${vehicle.registrationNumber}`);
            } catch (emailError) {
              console.error(`❌ Failed to send 364-day email to ${owner.email}:`, emailError.message);
            }
          }
        } else {
          // Handle pre-expiry reminders
          const startOfDay = new Date(now.getTime() + reminder.days * 24 * 60 * 60 * 1000);
          startOfDay.setHours(0, 0, 0, 0);

          const endOfDay = new Date(startOfDay);
          endOfDay.setHours(23, 59, 59, 999);

          const vehicles = await Vehicle.find({
            expiryDate: {
              $gte: startOfDay,
              $lte: endOfDay,
              $ne: null
            }
          }).populate('ownerId');

          const filteredVehicles = vehicles.filter(v =>
            v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active'
          );
          console.log(`📅 Found ${filteredVehicles.length} vehicles for ${reminder.label}`);

          for (const vehicle of filteredVehicles) {
            const owner = vehicle.ownerId;

            // Check for existing notification for this vehicle and reminder type
            const existingNotification = await Notification.findOne({
              userId: owner._id,
              type: 'reminder',
              'metadata.expiryDate': vehicle.expiryDate,
              'metadata.reminderDays': reminder.days,
              createdAt: { $gte: todayStart }
            });

            if (existingNotification) {
              console.log(`⏭️ Skipping duplicate reminder for ${owner.email} (already sent)`);
              continue;
            }

            const notification = await createNotification({
              userId: owner._id,
              title: `${reminder.label} - Insurance Renewal`,
              message: `Your vehicle ${vehicle.registrationNumber} insurance expires on ${vehicle.expiryDate.toDateString()}. Please renew to avoid service interruptions.`,
              type: 'reminder',
              metadata: {
                expiryDate: vehicle.expiryDate,
                reminderDays: reminder.days,
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
              console.log(`✅ Reminder sent to ${owner.email} for ${vehicle.registrationNumber}`);
            } catch (emailError) {
              console.error(`❌ Failed to send email to ${owner.email}:`, emailError.message);
            }
          }
        }
      }
      console.log('✅ Daily renewal reminders completed successfully');
    } catch (error) {
      console.error('❌ Cron job error:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });
};

const manualRunReminders = async () => {
  console.log('🔄 Manual run of renewal reminders...');

  try {
    const now = new Date();
    console.log(`🔍 Manual run at: ${now}`);

    const reminderDates = [
      { days: 365, label: '364 Day Reminder', type: 'post-start' },
      { days: 30, label: '30 Day Reminder', type: 'pre-expiry' },
      { days: 7, label: '7 Day Reminder', type: 'pre-expiry' },
      { days: 1, label: '1 Day Reminder', type: 'pre-expiry' },
      { days: -1, label: 'Post-Expiry Reminder', type: 'post-expiry' },
    ];
    let totalSent = 0;

    // Define the start and end of the current day for notification checks
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    for (const reminder of reminderDates) {
      if (reminder.type === 'post-expiry') {
        // Handle post-expiry reminders
        const startOfDay = new Date(now);
        startOfDay.setDate(startOfDay.getDate() - 1);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        const vehicles = await Vehicle.find({
          expiryDate: {
            $gte: startOfDay,
            $lte: endOfDay,
            $ne: null
          }
        }).populate('ownerId');
        const filteredVehicles = vehicles.filter(v =>
          v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active'
        );
        console.log(`📅 Manual: Found ${filteredVehicles.length} vehicles for ${reminder.label}`);

        for (const vehicle of filteredVehicles) {
          const owner = vehicle.ownerId;

          // Check for existing notification for this vehicle and reminder type
          const existingNotification = await Notification.findOne({
            userId: owner._id,
            type: 'reminder',
            'metadata.expiryDate': vehicle.expiryDate,
            'metadata.reminderDays': -1,
            createdAt: { $gte: todayStart }
          });

          if (existingNotification) {
            console.log(`⏭️ Manual: Skipping duplicate post-expiry reminder for ${owner.email} (already sent)`);
            continue;
          }

          const notification = await createNotification({
            userId: owner._id,
            title: `${reminder.label} - Insurance Expired (Manual)`,
            message: `Your vehicle ${vehicle.registrationNumber} insurance has expired on ${vehicle.expiryDate.toDateString()}. Please renew immediately to avoid service interruptions and legal issues.`,
            type: 'reminder',
            metadata: {
              expiryDate: vehicle.expiryDate,
              reminderDays: -1,
              postExpiry: true,
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
            totalSent++;
            console.log(`✅ Manual post-expiry reminder sent to ${owner.email}`);
          } catch (emailError) {
            console.error(`❌ Manual post-expiry email failed for ${owner.email}:`, emailError.message);
          }
        }
      } else if (reminder.type === 'post-start') {
        // Handle 364-day reminders
        const startOfDay = new Date(now);
        startOfDay.setDate(startOfDay.getDate() - 1);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        console.log(`🔍 Manual 364-Day: Looking for start dates between ${startOfDay} and ${endOfDay}`);

        const vehicles = await Vehicle.find({
          startDate: {
            $gte: startOfDay,
            $lte: endOfDay,
            $ne: null
          },
          expiryDate: { $ne: null }
        }).populate('ownerId');

        const filteredVehicles = vehicles.filter(v =>
          v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active'
        );

        console.log(`📅 Manual: Found ${filteredVehicles.length} vehicles for ${reminder.label}`);
        filteredVehicles.forEach(vehicle => {
          console.log(`   - ${vehicle.registrationNumber}: Start=${vehicle.startDate}, Expiry=${vehicle.expiryDate}`);
        });

        for (const vehicle of filteredVehicles) {
          const owner = vehicle.ownerId;

          // Check for existing notification for this vehicle and reminder type
          const existingNotification = await Notification.findOne({
            userId: owner._id,
            type: 'reminder',
            'metadata.reminderDays': 365,
            'metadata.startDate': vehicle.startDate,
            createdAt: { $gte: todayStart }
          });

          if (existingNotification) {
            console.log(`⏭️ Manual: Skipping duplicate 364-day reminder for ${owner.email} (already sent)`);
            continue;
          }

          const notification = await createNotification({
            userId: owner._id,
            title: `${reminder.label} - Insurance Started (Manual)`,
            message: `Your vehicle ${vehicle.registrationNumber} insurance started on ${vehicle.startDate.toDateString()} and will expire on ${vehicle.expiryDate.toDateString()}. Please note this renewal date to ensure continuous coverage next year.`,
            type: 'reminder',
            metadata: {
              startDate: vehicle.startDate,
              expiryDate: vehicle.expiryDate,
              reminderDays: 365,
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
            totalSent++;
            console.log(`✅ Manual 364-day reminder sent to ${owner.email}`);
          } catch (emailError) {
            console.error(`❌ Manual 364-day email failed for ${owner.email}:`, emailError.message);
          }
        }
      } else {
        // Handle pre-expiry reminders
        const startOfDay = new Date(now.getTime() + reminder.days * 24 * 60 * 60 * 1000);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        const vehicles = await Vehicle.find({
          expiryDate: {
            $gte: startOfDay,
            $lte: endOfDay,
            $ne: null
          }
        }).populate('ownerId');
        const filteredVehicles = vehicles.filter(v =>
          v.ownerId && v.ownerId.role === 'customer' && v.ownerId.accountStatus === 'active'
        );
        console.log(`📅 Manual: Found ${filteredVehicles.length} vehicles for ${reminder.label}`);

        for (const vehicle of filteredVehicles) {
          const owner = vehicle.ownerId;

          // Check for existing notification for this vehicle and reminder type
          const existingNotification = await Notification.findOne({
            userId: owner._id,
            type: 'reminder',
            'metadata.expiryDate': vehicle.expiryDate,
            'metadata.reminderDays': reminder.days,
            createdAt: { $gte: todayStart }
          });

          if (existingNotification) {
            console.log(`⏭️ Manual: Skipping duplicate reminder for ${owner.email} (already sent)`);
            continue;
          }

          const notification = await createNotification({
            userId: owner._id,
            title: `${reminder.label} - Insurance Renewal (Manual)`,
            message: `Your vehicle ${vehicle.registrationNumber} insurance expires on ${vehicle.expiryDate.toDateString()}. Please renew to avoid service interruptions.`,
            type: 'reminder',
            metadata: {
              expiryDate: vehicle.expiryDate,
              reminderDays: reminder.days,
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
            totalSent++;
            console.log(`✅ Manual reminder sent to ${owner.email}`);
          } catch (emailError) {
            console.error(`❌ Manual email failed for ${owner.email}:`, emailError.message);
          }
        }
      }
    }
    console.log(`✅ Manual run completed. ${totalSent} reminders sent.`);
    return totalSent;
  } catch (error) {
    console.error('❌ Manual cron job error:', error);
    throw error;
  }
};

module.exports = {
  initializeCronJobs,
  manualRunReminders,
};