const STORAGE_KEY = 'tianan_thai_reservations';

const formatNumber = (value) => value.toString().padStart(2, '0');

const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${formatNumber(hours)}:${formatNumber(mins)}`;
};

const buildSlots = (duration) => {
  const startMinutes = 14 * 60;
  const endMinutes = 22 * 60;
  const interval = 30;
  const latestStart = endMinutes - duration;
  const slots = [];
  for (let minutes = startMinutes; minutes <= latestStart; minutes += interval) {
    const end = minutes + duration;
    slots.push({
      start: minutesToTime(minutes),
      end: minutesToTime(end),
      label: `${minutesToTime(minutes)} - ${minutesToTime(end)}`,
      disabled: false,
    });
  }
  return slots;
};

const overlaps = (slotStart, slotEnd, bookingStart, bookingEnd) => {
  return slotStart < bookingEnd && slotEnd > bookingStart;
};

Page({
  data: {
    studioName: '天安泰式',
    depositAmount: 50,
    selectedDate: '',
    durationOptions: [
      { label: '60 分钟', value: 60 },
      { label: '90 分钟', value: 90 },
    ],
    selectedDuration: 60,
    slots: [],
    selectedSlot: null,
    reservations: [],
  },

  onLoad() {
    const today = this.getToday();
    const reservations = this.getReservations();
    this.setData({
      selectedDate: today,
      reservations,
    });
    this.refreshSlots();
  },

  getToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = formatNumber(now.getMonth() + 1);
    const day = formatNumber(now.getDate());
    return `${year}-${month}-${day}`;
  },

  getReservations() {
    return wx.getStorageSync(STORAGE_KEY) || [];
  },

  saveReservations(reservations) {
    wx.setStorageSync(STORAGE_KEY, reservations);
  },

  handleDateChange(event) {
    this.setData({
      selectedDate: event.detail.value,
      selectedSlot: null,
    });
    this.refreshSlots();
  },

  handleDurationChange(event) {
    const value = Number(event.detail.value);
    this.setData({
      selectedDuration: value,
      selectedSlot: null,
    });
    this.refreshSlots();
  },

  refreshSlots() {
    const { selectedDuration, selectedDate } = this.data;
    const reservations = this.getReservations();
    const slots = buildSlots(selectedDuration).map((slot) => {
      const slotStart = this.timeToMinutes(slot.start);
      const slotEnd = this.timeToMinutes(slot.end);
      const hasOverlap = reservations.some((reservation) => {
        if (reservation.date !== selectedDate) {
          return false;
        }
        return overlaps(slotStart, slotEnd, reservation.startMinutes, reservation.endMinutes);
      });
      return { ...slot, disabled: hasOverlap };
    });
    this.setData({ slots, reservations });
  },

  timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  },

  selectSlot(event) {
    const { start, end, disabled } = event.currentTarget.dataset;
    if (disabled) {
      return;
    }
    this.setData({
      selectedSlot: { start, end },
    });
  },

  submitReservation() {
    const { selectedSlot, selectedDate, selectedDuration, depositAmount } = this.data;
    if (!selectedSlot) {
      wx.showToast({ title: '请选择可预约的时间段', icon: 'none' });
      return;
    }
    const reservations = this.getReservations();
    const startMinutes = this.timeToMinutes(selectedSlot.start);
    const endMinutes = this.timeToMinutes(selectedSlot.end);
    const hasOverlap = reservations.some((reservation) => {
      if (reservation.date !== selectedDate) {
        return false;
      }
      return overlaps(startMinutes, endMinutes, reservation.startMinutes, reservation.endMinutes);
    });
    if (hasOverlap) {
      wx.showToast({ title: '该时段已被预约，请选择其他时间', icon: 'none' });
      this.refreshSlots();
      return;
    }

    wx.showModal({
      title: '确认预约',
      content: `预约 ${selectedSlot.start} - ${selectedSlot.end}，需支付定金 ￥${depositAmount}`,
      confirmText: '支付定金',
      success: (result) => {
        if (result.confirm) {
          const updated = [
            ...reservations,
            {
              date: selectedDate,
              start: selectedSlot.start,
              end: selectedSlot.end,
              duration: selectedDuration,
              startMinutes,
              endMinutes,
            },
          ];
          this.saveReservations(updated);
          this.setData({ selectedSlot: null });
          this.refreshSlots();
          wx.showToast({ title: '预约成功', icon: 'success' });
        }
      },
    });
  },
});
