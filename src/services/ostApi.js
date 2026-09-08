import axios from 'axios'

const base = '/api/ost'

export default {
  getSummary: (period = 'day') => axios.get(`${base}/summary`, { params: { period } }),
  startShift: (driverId) => axios.post(`${base}/shift/start`, { driverId }),
  stopShift: (shiftId) => axios.post(`${base}/shift/stop`, { shiftId }),
  addFuel: (entry) => axios.post(`${base}/fuel`, entry),
}
