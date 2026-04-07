import Notification from '../models/Notification.js';

// @desc    Get all notifications for user
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, isRead, filter } = req.query;
    const user = req.user;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const baseRecipientQuery = {
      $or: [
        { recipient: user._id },
        { recipients: user._id }
      ]
    };

    // unread badge count (recipient side only)
    const unreadCount = await Notification.countDocuments({
      ...baseRecipientQuery,
      isRead: false
    });

    // organizer sent announcements count
    const sentQuery = {
      sender: user._id,
      type: 'announcement'
    };
    const sentCount = user.role === 'organizer'
      ? await Notification.countDocuments(sentQuery)
      : 0;

    // total count for All tab label
    const recipientAllCount = await Notification.countDocuments(baseRecipientQuery);
    const allCount = user.role === 'organizer'
      ? recipientAllCount + sentCount
      : recipientAllCount;

    // SENT tab: only sent announcements
    if (filter === 'sent') {
      if (user.role !== 'organizer') {
        return res.status(403).json({
          success: false,
          message: 'Only organizers can view sent announcements'
        });
      }

      const sentNotifications = await Notification.find(sentQuery)
        .populate('sender', 'firstName lastName profilePhoto role')
        .populate('data.eventId', 'name')
        .populate('data.teamId', 'name')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      const data = sentNotifications.map((n) => {
        const obj = n.toObject ? n.toObject() : { ...n };
        obj.data = obj.data || {};
        obj.data.sentByMe = true;
        return obj;
      });

      return res.json({
        success: true,
        data,
        unreadCount,
        sentCount,
        allCount,
        pagination: {
          current: pageNum,
          pages: Math.ceil(sentCount / limitNum) || 1,
          total: sentCount
        }
      });
    }

    // READ / UNREAD tabs: recipient side only
    if (filter === 'read' || filter === 'unread' || isRead !== undefined) {
      const query = { ...baseRecipientQuery };
      if (filter === 'read' || isRead === 'true') query.isRead = true;
      if (filter === 'unread' || isRead === 'false') query.isRead = false;

      const notifications = await Notification.find(query)
        .populate('sender', 'firstName lastName profilePhoto role')
        .populate('data.eventId', 'name')
        .populate('data.teamId', 'name')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      const total = await Notification.countDocuments(query);

      return res.json({
        success: true,
        data: notifications,
        unreadCount,
        sentCount,
        allCount,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum) || 1,
          total
        }
      });
    }

    // ALL tab:
    // - organizers: recipient notifications + sent announcements
    // - others: recipient notifications only
    if (user.role === 'organizer') {
      const [received, sent] = await Promise.all([
        Notification.find(baseRecipientQuery)
          .populate('sender', 'firstName lastName profilePhoto role')
          .populate('data.eventId', 'name')
          .populate('data.teamId', 'name')
          .sort({ createdAt: -1 })
          .lean(),
        Notification.find(sentQuery)
          .populate('sender', 'firstName lastName profilePhoto role')
          .populate('data.eventId', 'name')
          .populate('data.teamId', 'name')
          .sort({ createdAt: -1 })
          .lean()
      ]);

      const merged = [...received, ...sent]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const total = merged.length;
      const start = (pageNum - 1) * limitNum;
      const data = merged.slice(start, start + limitNum);

      return res.json({
        success: true,
        data,
        unreadCount,
        sentCount,
        allCount,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum) || 1,
          total
        }
      });
    }

    // non-organizer ALL
    const notifications = await Notification.find(baseRecipientQuery)
      .populate('sender', 'firstName lastName profilePhoto role')
      .populate('data.eventId', 'name')
      .populate('data.teamId', 'name')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.json({
      success: true,
      data: notifications,
      unreadCount,
      sentCount,
      allCount,
      pagination: {
        current: pageNum,
        pages: Math.ceil(recipientAllCount / limitNum) || 1,
        total: recipientAllCount
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      $or: [
        { recipient: req.user._id },
        { recipients: req.user._id }
      ],
      isRead: false
    });

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      $or: [
        { recipient: req.user._id },
        { recipients: req.user._id }
      ]
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        $or: [
          { recipient: req.user._id },
          { recipients: req.user._id }
        ],
        isRead: false
      },
      { $set: { isRead: true, readAt: new Date() } }
    );
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const userId = req.user._id.toString();
    const senderId = notification.sender && notification.sender.toString();

    if (senderId === userId) {
      await Notification.findByIdAndDelete(req.params.id);
      return res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    }

    const isRecipient =
      (notification.recipient && notification.recipient.toString() === userId) ||
      (notification.recipients &&
        notification.recipients.some((r) => r.toString() === userId));

    if (!isRecipient) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (notification.recipients && notification.recipients.length > 0) {
      await Notification.findByIdAndUpdate(req.params.id, {
        $pull: { recipients: req.user._id }
      });
    } else {
      await Notification.findByIdAndDelete(req.params.id);
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete all notifications
// @route   DELETE /api/notifications
// @access  Private
export const deleteAllNotifications = async (req, res) => {
  try {
    // Single-recipient docs: delete
    await Notification.deleteMany({ recipient: req.user._id });
    // Broadcast docs: remove this user from recipients
    await Notification.updateMany(
      { recipients: req.user._id },
      { $pull: { recipients: req.user._id } }
    );

    res.json({
      success: true,
      message: 'All notifications deleted successfully'
    });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create notification (internal use)
// @route   POST /api/notifications
// @access  Private (Admin/Organizer)
export const createNotification = async (req, res) => {
  try {
    const { recipient, type, title, message, data, priority } = req.body;

    const notification = await Notification.create({
      recipient,
      sender: req.user._id,
      type,
      title,
      message,
      data,
      priority
    });

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: notification
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Send bulk notifications
// @route   POST /api/notifications/bulk
// @access  Private (Admin/Organizer)
export const sendBulkNotifications = async (req, res) => {
  try {
    const { recipients, type, title, message, data, priority } = req.body;

    const notifications = recipients.map(recipient => ({
      recipient,
      sender: req.user._id,
      type,
      title,
      message,
      data,
      priority
    }));

    await Notification.insertMany(notifications);

    res.status(201).json({
      success: true,
      message: `${notifications.length} notifications sent successfully`
    });
  } catch (error) {
    console.error('Send bulk notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
