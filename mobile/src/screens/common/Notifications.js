import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useDispatch, useSelector } from "react-redux";

import AppHeaderBar from "../../components/AppHeaderBar";
import { SCREENS } from "../../constants/navigation";
import { navigateToEventsStack, navigateToOrganizerTab } from "../../navigation/navigationRef";
import organizerService from "../../services/organizerService";
import notificationService from "../../services/notificationService";
import {
  deleteNotification,
  fetchUnreadCount,
  markAllAsRead,
  markAsRead,
  setUnreadCount,
} from "../../store/slices/notificationSlice";
import { selectUser } from "../../store/slices/authSlice";
import teamService from "../../services/teamService";
import { formatDate, formatRelativeTime, getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";

const PAGE_SIZE = 15;

function getNotificationIcon(type) {
  const map = {
    event_created: { name: "calendar", color: "#3b82f6", bg: "bg-blue-100 dark:bg-blue-900/35" },
    event_updated: { name: "calendar", color: "#eab308", bg: "bg-yellow-100 dark:bg-yellow-900/35" },
    event_cancelled: { name: "x-circle", color: "#ef4444", bg: "bg-red-100 dark:bg-red-900/35" },
    event_rescheduled: { name: "clock", color: "#f97316", bg: "bg-orange-100 dark:bg-orange-900/35" },
    event_pair_invite: { name: "users", color: "#a855f7", bg: "bg-purple-100 dark:bg-purple-900/35" },
    registration_confirmed: { name: "check-circle", color: "#22c55e", bg: "bg-green-100 dark:bg-green-900/35" },
    registration_cancelled: { name: "x-circle", color: "#ef4444", bg: "bg-red-100 dark:bg-red-900/35" },
    payment_received: { name: "dollar-sign", color: "#22c55e", bg: "bg-green-100 dark:bg-green-900/35" },
    payment_failed: { name: "dollar-sign", color: "#ef4444", bg: "bg-red-100 dark:bg-red-900/35" },
    team_invitation: { name: "users", color: "#a855f7", bg: "bg-purple-100 dark:bg-purple-900/35" },
    team_joined: { name: "users", color: "#22c55e", bg: "bg-green-100 dark:bg-green-900/35" },
    team_removed: { name: "users", color: "#ef4444", bg: "bg-red-100 dark:bg-red-900/35" },
    query_received: { name: "message-circle", color: "#3b82f6", bg: "bg-blue-100 dark:bg-blue-900/35" },
    query_response: { name: "message-circle", color: "#22c55e", bg: "bg-green-100 dark:bg-green-900/35" },
    achievement_unlocked: { name: "award", color: "#eab308", bg: "bg-yellow-100 dark:bg-yellow-900/35" },
    reminder: { name: "clock", color: "#f97316", bg: "bg-orange-100 dark:bg-orange-900/35" },
    announcement: { name: "alert-circle", color: "#3b82f6", bg: "bg-blue-100 dark:bg-blue-900/35" },
    system: { name: "bell", color: "#6b7280", bg: "bg-neutral-100 dark:bg-white/10" },
  };
  return map[type] || map.system;
}

function getPriorityLabel(priority) {
  const p = String(priority || "medium").toLowerCase();
  if (p === "low") return "Low";
  if (p === "high") return "High";
  if (p === "urgent") return "Urgent";
  return null;
}

function eventIdFromNotification(n) {
  const raw = n?.data?.eventId;
  if (!raw) return null;
  if (typeof raw === "object" && raw._id) return String(raw._id);
  return String(raw);
}

/** Organizer / standard team invite — `POST /teams/:id/invite` stores `data.teamId`. */
function teamIdFromNotification(n) {
  const raw = n?.data?.teamId;
  if (!raw) return null;
  if (typeof raw === "object" && raw._id) return String(raw._id);
  return String(raw);
}

function queryIdFromNotification(n) {
  const raw = n?.data?.queryId;
  if (!raw) return null;
  if (typeof raw === "object" && raw._id) return String(raw._id);
  return String(raw);
}

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isOrganizer = String(user?.role || "").toLowerCase() === "organizer";

  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCountLocal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [respondingTeamInviteId, setRespondingTeamInviteId] = useState(null);

  /** Organizer-only: matches web `GET /notifications?filter=sent` + `sentCount` / `allCount`. */
  const [sentCount, setSentCount] = useState(0);
  const [allCount, setAllCount] = useState(0);

  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [eventsForAnnouncement, setEventsForAnnouncement] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    eventId: "",
    title: "",
    message: "",
    priority: "medium",
    includeWithdrawn: false,
  });
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  useEffect(() => {
    if (!isOrganizer && filter === "sent") setFilter("all");
  }, [isOrganizer, filter]);

  const fetchNotifications = useCallback(
    async ({ pull = false } = {}) => {
      if (pull) setRefreshing(true);
      else setIsLoading(true);
      try {
        const params = { page, limit: PAGE_SIZE };
        if (isOrganizer && filter === "sent") {
          params.filter = "sent";
        } else {
          if (filter === "unread") params.isRead = false;
          if (filter === "read") params.isRead = true;
        }

        const response = await notificationService.getNotifications(params);
        const list = Array.isArray(response?.data) ? response.data : [];
        setNotifications(list);
        setUnreadCountLocal(typeof response?.unreadCount === "number" ? response.unreadCount : 0);
        setSentCount(typeof response?.sentCount === "number" ? response.sentCount : 0);
        setAllCount(
          response?.allCount != null ? response.allCount : response?.pagination?.total ?? list.length,
        );
        setPagination(response?.pagination || { current: page, pages: 1, total: list.length });
        await dispatch(fetchUnreadCount()).unwrap();
      } catch (error) {
        toast.error(getErrorMessage(error) || "Failed to load notifications");
        setNotifications([]);
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [dispatch, filter, page, isOrganizer],
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    fetchNotifications({ pull: true });
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notification) => {
    if (!notification || notification.isRead) return;
    if (notification.data?.sentByMe) return;
    try {
      await dispatch(markAsRead(notification._id)).unwrap();
      setNotifications((prev) =>
        prev.map((n) => (String(n._id) === String(notification._id) ? { ...n, isRead: true } : n)),
      );
      setUnreadCountLocal((c) => Math.max(0, c - 1));
      await dispatch(fetchUnreadCount()).unwrap();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Could not mark as read");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await dispatch(markAllAsRead()).unwrap();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCountLocal(0);
      await dispatch(fetchUnreadCount()).unwrap();
      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Could not mark all as read");
    }
  };

  const performDeleteOne = async () => {
    const n = deleteTarget;
    if (!n) return;
    if (n.data?.sentByMe) {
      toast.error("Sent announcements cannot be deleted from this list.");
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      await dispatch(deleteNotification(n._id)).unwrap();
      setNotifications((prev) => prev.filter((x) => String(x._id) !== String(n._id)));
      if (!n.isRead) setUnreadCountLocal((c) => Math.max(0, c - 1));
      await dispatch(fetchUnreadCount()).unwrap();
      toast.success("Notification deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error) || "Could not delete");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = () => {
    if (notifications.length === 0) return;
    if (isOrganizer && filter === "sent") return;
    Alert.alert(
      "Clear all notifications",
      `This will permanently delete ${pagination.total} notification${pagination.total !== 1 ? "s" : ""}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete all",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await notificationService.deleteAllNotifications();
              setNotifications([]);
              setUnreadCountLocal(0);
              setPagination({ current: 1, pages: 1, total: 0 });
              dispatch(setUnreadCount(0));
              await dispatch(fetchUnreadCount()).unwrap();
              toast.success("All notifications deleted");
            } catch (error) {
              toast.error(getErrorMessage(error) || "Could not delete all");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const openEvent = (notification) => {
    const eid = eventIdFromNotification(notification);
    if (!eid) return;
    handleMarkAsRead(notification);
    if (isOrganizer) {
      navigateToOrganizerTab(SCREENS.OrganizerTabEvents, SCREENS.EventDetails, {
        eventId: eid,
        organizerMode: true,
      });
    } else {
      navigation.navigate(SCREENS.EventDetails, { eventId: eid });
    }
  };

  const openOrganizerQueries = () => {
    navigateToOrganizerTab(SCREENS.OrganizerTabHome, SCREENS.OrganizerMyQueriesScreen);
  };

  const openQueryNotification = (notification) => {
    handleMarkAsRead(notification);
    if (isOrganizer) openOrganizerQueries();
  };

  const openAnnouncementModal = async () => {
    setAnnouncementOpen(true);
    setLoadingEvents(true);
    try {
      const res = await organizerService.getMyEvents({ page: 1, limit: 100 });
      const rows = Array.isArray(res?.data) ? res.data : [];
      setEventsForAnnouncement(rows);
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to load your events");
      setEventsForAnnouncement([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleSendEventAnnouncement = async () => {
    if (!announcementForm.eventId) {
      toast.error("Please select an event");
      return;
    }
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      toast.error("Please enter title and message");
      return;
    }
    setSendingAnnouncement(true);
    try {
      const res = await organizerService.sendEventAnnouncement(announcementForm.eventId, {
        title: announcementForm.title.trim(),
        message: announcementForm.message.trim(),
        priority: announcementForm.priority,
        includeWithdrawn: announcementForm.includeWithdrawn,
      });
      toast.success(res?.message || "Announcement sent");
      setAnnouncementOpen(false);
      setAnnouncementForm({
        eventId: "",
        title: "",
        message: "",
        priority: "medium",
        includeWithdrawn: false,
      });
      await fetchNotifications({ pull: true });
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to send announcement");
    } finally {
      setSendingAnnouncement(false);
    }
  };

  /** Same flow as `frontend` Team Invites: `teamService.respondToPlayerInvite(teamId, action)`. */
  const handleTeamInviteResponse = async (notification, action) => {
    const teamId = teamIdFromNotification(notification);
    if (!teamId) {
      toast.error("This notification has no team reference. Open Team invitations from the menu.");
      return;
    }
    const nid = String(notification._id);
    try {
      setRespondingTeamInviteId(nid);
      await teamService.respondToPlayerInvite(teamId, action);
      toast.success(action === "accept" ? "Invitation accepted" : "Invitation rejected");
      setNotifications((prev) => prev.filter((x) => String(x._id) !== nid));
      setUnreadCountLocal((c) => (!notification.isRead ? Math.max(0, c - 1) : c));
      try {
        await dispatch(deleteNotification(notification._id)).unwrap();
      } catch {
        /* notification row may already be gone server-side */
      }
      await dispatch(fetchUnreadCount()).unwrap();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Could not update invitation");
    } finally {
      setRespondingTeamInviteId(null);
    }
  };

  const groupedNotifications = useMemo(() => {
    return notifications.reduce((groups, notification) => {
      const date = formatDate(notification.createdAt);
      if (!groups[date]) groups[date] = [];
      groups[date].push(notification);
      return groups;
    }, {});
  }, [notifications]);

  const registrationCount = useMemo(
    () =>
      notifications.filter(
        (n) => n.type === "registration_confirmed" || n.type === "registration_cancelled",
      ).length,
    [notifications],
  );
  const paymentCount = useMemo(
    () => notifications.filter((n) => n.type === "payment_received" || n.type === "payment_failed").length,
    [notifications],
  );
  const queryCount = useMemo(
    () => notifications.filter((n) => n.type === "query_received" || n.type === "query_response").length,
    [notifications],
  );

  const chip = (active) =>
    active
      ? "border-primary bg-primary"
      : "border-neutral-200 bg-white dark:border-white/15 dark:bg-white/5";

  const chipText = (active) => (active ? "text-white" : "text-neutral-800 dark:text-white/85");

  return (
    <View className="flex-1 bg-white dark:bg-[#1F2B55]">
      <AppHeaderBar title="Notifications" showNotifications={false} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 24,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1F2B55" />}
      >
        <View className="px-5 pt-2">
          <Text className="font-playfair text-sm text-neutral-500 dark:text-white/55">
            {isOrganizer
              ? "Stay updated with registrations, payments, and player queries"
              : "Stay updated with your events and activities"}
          </Text>

          <View className="mt-4 flex-row flex-wrap items-center gap-2">
            <Pressable
              onPress={() => fetchNotifications({ pull: true })}
              className="h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 dark:border-white/15"
            >
              <Feather name="refresh-cw" size={18} color="#1F2B55" />
            </Pressable>
            {isOrganizer ? (
              <Pressable
                onPress={openAnnouncementModal}
                className="flex-row items-center gap-1.5 rounded-xl bg-primary px-3 py-2"
              >
                <Feather name="send" size={16} color="#fff" />
                <Text className="font-newsreader-bold text-xs text-white">Send announcement</Text>
              </Pressable>
            ) : null}
            {unreadCount > 0 ? (
              <Pressable
                onPress={handleMarkAllAsRead}
                className="rounded-xl border border-neutral-200 px-3 py-2 dark:border-white/15"
              >
                <Text className="font-newsreader-bold text-xs text-neutral-900 dark:text-white">Mark all read</Text>
              </Pressable>
            ) : null}
            {notifications.length > 0 && !(isOrganizer && filter === "sent") ? (
              <Pressable
                onPress={handleDeleteAll}
                disabled={deleting}
                className="rounded-xl border border-red-300 px-3 py-2 dark:border-red-500/40"
              >
                <Text className="font-newsreader-bold text-xs text-red-600 dark:text-red-400">Clear all</Text>
              </Pressable>
            ) : null}
          </View>

          {isOrganizer ? (
            <View className="mt-4 flex-row flex-wrap gap-2">
              <View className="min-w-[45%] flex-1 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-3">
                <Text className="text-center font-newsreader-bold text-2xl text-primary">{unreadCount}</Text>
                <Text className="text-center font-playfair text-xs text-neutral-600 dark:text-white/60">Unread</Text>
              </View>
              <View className="min-w-[45%] flex-1 rounded-2xl border border-green-500/25 bg-green-500/10 px-3 py-3">
                <Text className="text-center font-newsreader-bold text-2xl text-green-600 dark:text-green-400">
                  {registrationCount}
                </Text>
                <Text className="text-center font-playfair text-xs text-neutral-600 dark:text-white/60">
                  Registrations
                </Text>
              </View>
              <View className="min-w-[45%] flex-1 rounded-2xl border border-blue-500/25 bg-blue-500/10 px-3 py-3">
                <Text className="text-center font-newsreader-bold text-2xl text-blue-600 dark:text-blue-400">
                  {paymentCount}
                </Text>
                <Text className="text-center font-playfair text-xs text-neutral-600 dark:text-white/60">Payments</Text>
              </View>
              <View className="min-w-[45%] flex-1 rounded-2xl border border-purple-500/25 bg-purple-500/10 px-3 py-3">
                <Text className="text-center font-newsreader-bold text-2xl text-purple-600 dark:text-purple-400">
                  {queryCount}
                </Text>
                <Text className="text-center font-playfair text-xs text-neutral-600 dark:text-white/60">Queries</Text>
              </View>
            </View>
          ) : unreadCount > 0 ? (
            <View className="mt-4 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3">
              <Text className="text-center font-newsreader-bold text-2xl text-primary">{unreadCount}</Text>
              <Text className="text-center font-playfair text-xs text-neutral-600 dark:text-white/60">Unread</Text>
            </View>
          ) : null}

          <View className="mt-4 flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => {
                setFilter("all");
                setPage(1);
              }}
              className={`rounded-full border px-4 py-2 ${chip(filter === "all")}`}
            >
              <Text className={`font-newsreader-bold text-xs ${chipText(filter === "all")}`}>
                All ({allCount || pagination.total})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setFilter("unread");
                setPage(1);
              }}
              className={`rounded-full border px-4 py-2 ${chip(filter === "unread")}`}
            >
              <Text className={`font-newsreader-bold text-xs ${chipText(filter === "unread")}`}>
                Unread ({unreadCount})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setFilter("read");
                setPage(1);
              }}
              className={`rounded-full border px-4 py-2 ${chip(filter === "read")}`}
            >
              <Text className={`font-newsreader-bold text-xs ${chipText(filter === "read")}`}>Read</Text>
            </Pressable>
            {isOrganizer ? (
              <Pressable
                onPress={() => {
                  setFilter("sent");
                  setPage(1);
                }}
                className={`rounded-full border px-4 py-2 ${chip(filter === "sent")}`}
              >
                <Text className={`font-newsreader-bold text-xs ${chipText(filter === "sent")}`}>
                  Sent ({sentCount})
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View className="mt-4 px-5">
          {isLoading ? (
            <View className="items-center py-16">
              <ActivityIndicator color="#1F2B55" size="large" />
              <Text className="mt-3 font-playfair text-sm text-neutral-500 dark:text-white/55">Loading…</Text>
            </View>
          ) : notifications.length > 0 ? (
            <>
              {Object.entries(groupedNotifications).map(([date, dateNotifications]) => (
                <View key={date} className="mb-6">
                  <Text className="mb-2 font-newsreader-bold text-xs uppercase tracking-wide text-neutral-500 dark:text-white/50">
                    {date}
                  </Text>
                  {dateNotifications.map((notification) => {
                    const icon = getNotificationIcon(notification.type);
                    const pri = String(notification.priority || "medium").toLowerCase();
                    const priority = pri !== "medium" ? getPriorityLabel(notification.priority) : null;
                    const isSentByMe = Boolean(notification.data?.sentByMe);
                    const eid = eventIdFromNotification(notification);
                    const tid = teamIdFromNotification(notification);
                    const qid = queryIdFromNotification(notification);
                    const isTeamInvite =
                      !isOrganizer && notification.type === "team_invitation" && Boolean(tid);
                    const eventName =
                      notification?.data?.eventId && typeof notification.data.eventId === "object"
                        ? notification.data.eventId.name
                        : null;
                    const sender = notification.sender;
                    const senderName = sender
                      ? `${sender.firstName || ""} ${sender.lastName || ""}`.trim() || sender.email || ""
                      : "";
                    const highlightUnread = !isSentByMe && !notification.isRead;

                    return (
                      <View
                        key={String(notification._id)}
                        className={`mb-2 rounded-2xl border p-4 ${
                          highlightUnread
                            ? "border-primary/40 bg-primary/5 dark:bg-primary/15"
                            : "border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5"
                        }`}
                      >
                        <View className="flex-row gap-3">
                          <View
                            className={`h-11 w-11 items-center justify-center rounded-full ${icon.bg}`}
                          >
                            <Feather name={icon.name} size={20} color={icon.color} />
                          </View>
                          <View className="min-w-0 flex-1">
                            <View className="flex-row flex-wrap items-center gap-2">
                              <Text
                                className={`flex-1 font-newsreader-bold text-base ${
                                  highlightUnread
                                    ? "text-neutral-900 dark:text-white"
                                    : "text-neutral-700 dark:text-white/80"
                                }`}
                              >
                                {notification.title}
                              </Text>
                              {isSentByMe ? (
                                <View className="rounded-full bg-sky-100 px-2 py-0.5 dark:bg-sky-900/40">
                                  <Text className="font-playfair text-[10px] text-sky-900 dark:text-sky-100">
                                    Sent by you
                                  </Text>
                                </View>
                              ) : null}
                              {priority ? (
                                <View className="rounded-full bg-amber-100 px-2 py-0.5 dark:bg-amber-900/40">
                                  <Text className="font-playfair text-[10px] text-amber-900 dark:text-amber-100">
                                    {priority}
                                  </Text>
                                </View>
                              ) : null}
                              {highlightUnread ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
                            </View>
                            <Text className="mt-1 font-playfair text-sm leading-5 text-neutral-600 dark:text-white/70">
                              {notification.message}
                            </Text>
                            <Text className="mt-2 font-playfair text-xs text-neutral-500 dark:text-white/50">
                              {formatRelativeTime(notification.createdAt)}
                            </Text>
                            {!isSentByMe && senderName ? (
                              <Text className="mt-1 font-playfair text-xs text-neutral-700 dark:text-white/65">
                                From: {senderName}
                                {sender?.role ? ` (${sender.role})` : ""}
                              </Text>
                            ) : null}
                            {eventName ? (
                              <Pressable
                                onPress={() => eid && openEvent(notification)}
                                disabled={!eid}
                                className="mt-1 self-start"
                              >
                                <Text className="font-playfair text-xs text-primary">Event: {eventName}</Text>
                              </Pressable>
                            ) : null}

                            {!isOrganizer && notification.type === "event_pair_invite" ? (
                              <Pressable
                                onPress={() => navigation.navigate(SCREENS.TeamInvites)}
                                className="mt-3 self-start rounded-xl bg-primary px-3 py-2"
                              >
                                <Text className="font-newsreader-bold text-xs text-white">Open team invites</Text>
                              </Pressable>
                            ) : null}

                            {isTeamInvite ? (
                              <View className="mt-3 gap-2">
                                <Text className="font-playfair text-xs text-neutral-500 dark:text-white/55">
                                  Accept or decline this join request (same as web Team invitations).
                                </Text>
                                <View className="flex-row gap-2">
                                  <Pressable
                                    onPress={() => handleTeamInviteResponse(notification, "accept")}
                                    disabled={respondingTeamInviteId === String(notification._id)}
                                    className="flex-1 items-center rounded-xl bg-primary py-3 opacity-100 disabled:opacity-50"
                                  >
                                    {respondingTeamInviteId === String(notification._id) ? (
                                      <ActivityIndicator color="#fff" />
                                    ) : (
                                      <Text className="font-newsreader-bold text-xs text-white">Accept</Text>
                                    )}
                                  </Pressable>
                                  <Pressable
                                    onPress={() => handleTeamInviteResponse(notification, "reject")}
                                    disabled={respondingTeamInviteId === String(notification._id)}
                                    className="flex-1 items-center rounded-xl border border-red-300 bg-red-50 py-3 dark:border-red-800 dark:bg-red-900/30 opacity-100 disabled:opacity-50"
                                  >
                                    <Text className="font-newsreader-bold text-xs text-red-700 dark:text-red-200">
                                      Reject
                                    </Text>
                                  </Pressable>
                                </View>
                                <Pressable
                                  onPress={() => navigation.navigate(SCREENS.TeamInvites)}
                                  className="self-start rounded-xl border border-neutral-200 px-3 py-2 dark:border-white/15"
                                >
                                  <Text className="font-newsreader-bold text-xs text-neutral-900 dark:text-white">
                                    Open Team invitations
                                  </Text>
                                </Pressable>
                              </View>
                            ) : null}

                            <View className="mt-3 flex-row flex-wrap gap-2">
                              {eid ? (
                                <Pressable
                                  onPress={() => openEvent(notification)}
                                  className="rounded-xl border border-neutral-200 px-3 py-2 dark:border-white/15"
                                >
                                  <Text className="font-newsreader-bold text-xs text-neutral-900 dark:text-white">
                                    View event
                                  </Text>
                                </Pressable>
                              ) : null}
                              {isOrganizer && qid ? (
                                <Pressable
                                  onPress={() => openQueryNotification(notification)}
                                  className="rounded-xl border border-neutral-200 px-3 py-2 dark:border-white/15"
                                >
                                  <Text className="font-newsreader-bold text-xs text-neutral-900 dark:text-white">
                                    View queries
                                  </Text>
                                </Pressable>
                              ) : null}
                              {!isSentByMe && !notification.isRead ? (
                                <Pressable
                                  onPress={() => handleMarkAsRead(notification)}
                                  className="rounded-xl border border-neutral-200 px-3 py-2 dark:border-white/15"
                                >
                                  <Text className="font-newsreader-bold text-xs text-neutral-900 dark:text-white">
                                    Mark read
                                  </Text>
                                </Pressable>
                              ) : null}
                              {!isSentByMe ? (
                                <Pressable
                                  onPress={() => setDeleteTarget(notification)}
                                  className="rounded-xl border border-red-200 px-3 py-2 dark:border-red-500/40"
                                >
                                  <Text className="font-newsreader-bold text-xs text-red-600 dark:text-red-400">
                                    Delete
                                  </Text>
                                </Pressable>
                              ) : null}
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}

              {pagination.pages > 1 ? (
                <View className="mb-8 flex-row items-center justify-center gap-4 py-2">
                  <Pressable
                    disabled={page <= 1}
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-xl border border-neutral-200 px-4 py-2 opacity-100 disabled:opacity-40 dark:border-white/15"
                  >
                    <Text className="font-newsreader-bold text-sm text-neutral-900 dark:text-white">Previous</Text>
                  </Pressable>
                  <Text className="font-playfair text-sm text-neutral-600 dark:text-white/65">
                    {pagination.current} / {pagination.pages}
                  </Text>
                  <Pressable
                    disabled={page >= pagination.pages}
                    onPress={() => setPage((p) => p + 1)}
                    className="rounded-xl border border-neutral-200 px-4 py-2 opacity-100 disabled:opacity-40 dark:border-white/15"
                  >
                    <Text className="font-newsreader-bold text-sm text-neutral-900 dark:text-white">Next</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : (
            <View className="items-center rounded-2xl border border-dashed border-neutral-200 py-14 dark:border-white/15">
              <Feather name="bell" size={40} color="rgba(107,114,128,0.5)" />
              <Text className="mt-4 font-newsreader-bold text-lg text-neutral-900 dark:text-white">
                No notifications
              </Text>
              <Text className="mt-2 px-6 text-center font-playfair text-sm text-neutral-500 dark:text-white/55">
                {filter === "unread"
                  ? "You're all caught up — no unread notifications."
                  : filter === "read"
                    ? "No read notifications in this view."
                    : filter === "sent" && isOrganizer
                      ? "You have not sent any announcements yet. Use Send announcement to notify your event."
                      : isOrganizer && filter === "all"
                        ? "You don't have any notifications yet. They'll appear here when players register for your events."
                        : "You don't have any notifications yet."}
              </Text>
              {filter !== "all" ? (
                <Pressable
                  onPress={() => {
                    setFilter("all");
                    setPage(1);
                  }}
                  className="mt-6 rounded-2xl bg-primary px-5 py-3"
                >
                  <Text className="font-newsreader-bold text-white">View all</Text>
                </Pressable>
              ) : isOrganizer ? (
                <Pressable
                  onPress={() =>
                    navigateToOrganizerTab(SCREENS.OrganizerTabEvents, SCREENS.OrganizerMyEvents)
                  }
                  className="mt-6 rounded-2xl bg-primary px-5 py-3"
                >
                  <Text className="font-newsreader-bold text-white">Manage events</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => navigateToEventsStack(SCREENS.EventsHome)}
                  className="mt-6 rounded-2xl bg-primary px-5 py-3"
                >
                  <Text className="font-newsreader-bold text-white">Find events</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={announcementOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setAnnouncementOpen(false);
          setAnnouncementForm({
            eventId: "",
            title: "",
            message: "",
            priority: "medium",
            includeWithdrawn: false,
          });
        }}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => {
            setAnnouncementOpen(false);
            setAnnouncementForm({
              eventId: "",
              title: "",
              message: "",
              priority: "medium",
              includeWithdrawn: false,
            });
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="max-h-[92%] rounded-t-3xl bg-white px-5 pb-8 pt-6 dark:bg-[#1F2B55]"
          >
            <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">
              Send event announcement
            </Text>
            <ScrollView
              className="mt-4"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text className="font-playfair text-sm text-neutral-600 dark:text-white/65">Event</Text>
              {loadingEvents ? (
                <View className="items-center py-8">
                  <ActivityIndicator color="#1F2B55" />
                </View>
              ) : eventsForAnnouncement.length === 0 ? (
                <Text className="mt-2 font-playfair text-sm text-amber-600 dark:text-amber-400">
                  No events found. Create an event first.
                </Text>
              ) : (
                <View className="mt-2 gap-2">
                  {eventsForAnnouncement.map((ev) => (
                    <Pressable
                      key={String(ev._id)}
                      onPress={() =>
                        setAnnouncementForm((prev) => ({ ...prev, eventId: String(ev._id) }))
                      }
                      className={`rounded-xl border px-3 py-3 ${
                        announcementForm.eventId === String(ev._id)
                          ? "border-primary bg-primary/10"
                          : "border-neutral-200 dark:border-white/15"
                      }`}
                    >
                      <Text className="font-newsreader-bold text-neutral-900 dark:text-white">
                        {ev.name}
                        {ev.status ? ` (${ev.status})` : ""}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text className="mt-4 font-playfair text-sm text-neutral-600 dark:text-white/65">Title</Text>
              <TextInput
                value={announcementForm.title}
                onChangeText={(t) => setAnnouncementForm((prev) => ({ ...prev, title: t }))}
                placeholder="Announcement title"
                placeholderTextColor="#9ca3af"
                className="mt-1 rounded-xl border border-neutral-200 bg-white px-3 py-3 font-playfair text-neutral-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
              />

              <Text className="mt-4 font-playfair text-sm text-neutral-600 dark:text-white/65">Message</Text>
              <TextInput
                value={announcementForm.message}
                onChangeText={(t) => setAnnouncementForm((prev) => ({ ...prev, message: t }))}
                placeholder="Your message to participants and event staff…"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                className="mt-1 min-h-[120px] rounded-xl border border-neutral-200 bg-white px-3 py-3 font-playfair text-neutral-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
              />

              <Text className="mt-4 font-playfair text-sm text-neutral-600 dark:text-white/65">Priority</Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {["low", "medium", "high", "urgent"].map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setAnnouncementForm((prev) => ({ ...prev, priority: p }))}
                    className={`rounded-xl border px-3 py-2 ${
                      announcementForm.priority === p
                        ? "border-primary bg-primary"
                        : "border-neutral-200 dark:border-white/15"
                    }`}
                  >
                    <Text
                      className={`font-newsreader-bold text-xs capitalize ${
                        announcementForm.priority === p ? "text-white" : "text-neutral-900 dark:text-white"
                      }`}
                    >
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View className="mt-4 flex-row items-center gap-3">
                <Switch
                  value={announcementForm.includeWithdrawn}
                  onValueChange={(v) =>
                    setAnnouncementForm((prev) => ({ ...prev, includeWithdrawn: v }))
                  }
                />
                <Text className="flex-1 font-playfair text-sm text-neutral-700 dark:text-white/75">
                  Include withdrawn registrations (players and teams marked as withdrawn)
                </Text>
              </View>

              <Text className="mt-3 font-playfair text-xs text-neutral-500 dark:text-white/50">
                Recipients include registered players, team members, and event staff. Staff without a linked account receive an email instead of an in-app notification.
              </Text>
            </ScrollView>

            <View className="mt-4 flex-row justify-end gap-3 border-t border-neutral-200 pt-4 dark:border-white/10">
              <Pressable
                onPress={() => {
                  setAnnouncementOpen(false);
                  setAnnouncementForm({
                    eventId: "",
                    title: "",
                    message: "",
                    priority: "medium",
                    includeWithdrawn: false,
                  });
                }}
                className="rounded-xl border border-neutral-200 px-4 py-2.5 dark:border-white/15"
              >
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Cancel</Text>
              </Pressable>
              <Pressable
                disabled={loadingEvents || sendingAnnouncement}
                onPress={handleSendEventAnnouncement}
                className="rounded-xl bg-primary px-4 py-2.5 opacity-100 disabled:opacity-50"
              >
                {sendingAnnouncement ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-newsreader-bold text-white">Send to event</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <Pressable className="flex-1 justify-center bg-black/50 px-6" onPress={() => !deleting && setDeleteTarget(null)}>
          <Pressable onPress={(e) => e.stopPropagation()} className="rounded-2xl bg-white p-5 dark:bg-[#1F2B55]">
            <Text className="font-newsreader-bold text-lg text-neutral-900 dark:text-white">Delete notification?</Text>
            {deleteTarget ? (
              <View className="mt-3 rounded-xl bg-neutral-50 p-3 dark:bg-white/10">
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">{deleteTarget.title}</Text>
                <Text className="mt-1 font-playfair text-sm text-neutral-600 dark:text-white/65">{deleteTarget.message}</Text>
              </View>
            ) : null}
            <View className="mt-5 flex-row justify-end gap-3">
              <Pressable
                disabled={deleting}
                onPress={() => setDeleteTarget(null)}
                className="rounded-xl border border-neutral-200 px-4 py-2.5 dark:border-white/15"
              >
                <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Cancel</Text>
              </Pressable>
              <Pressable
                disabled={deleting}
                onPress={performDeleteOne}
                className="rounded-xl bg-red-600 px-4 py-2.5"
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-newsreader-bold text-white">Delete</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
