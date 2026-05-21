import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

export const FloorPlans = {
  list: () => api.get("/floorplans").then((r) => r.data),
  active: () => api.get("/floorplans/active").then((r) => r.data),
  get: (id) => api.get(`/floorplans/${id}`).then((r) => r.data),
  create: (body) => api.post("/floorplans", body).then((r) => r.data),
  activate: (id) => api.post(`/floorplans/${id}/activate`).then((r) => r.data),
  remove: (id) => api.delete(`/floorplans/${id}`).then((r) => r.data),
};

export const Beacons = {
  list: (floorplan_id) =>
    api
      .get("/beacons", { params: { floorplan_id } })
      .then((r) => r.data),
  create: (body) => api.post("/beacons", body).then((r) => r.data),
  update: (id, body) => api.put(`/beacons/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/beacons/${id}`).then((r) => r.data),
  heartbeat: (body) => api.post("/beacons/heartbeat", body).then((r) => r.data),
};

export const Aisles = {
  list: (floorplan_id) =>
    api.get("/aisles", { params: { floorplan_id } }).then((r) => r.data),
  create: (body) => api.post("/aisles", body).then((r) => r.data),
  remove: (id) => api.delete(`/aisles/${id}`).then((r) => r.data),
};

export const Products = {
  list: (floorplan_id, search) =>
    api
      .get("/products", { params: { floorplan_id, search } })
      .then((r) => r.data),
  get: (id) => api.get(`/products/${id}`).then((r) => r.data),
  create: (body) => api.post("/products", body).then((r) => r.data),
  update: (id, body) => api.put(`/products/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/products/${id}`).then((r) => r.data),
};

export const Positioning = {
  scan: (floorplan_id, readings) =>
    api
      .post("/positioning/scan", { floorplan_id, readings })
      .then((r) => r.data),
};

export const Proximity = {
  check: (floorplan_id, x, y) =>
    api
      .get("/proximity", { params: { floorplan_id, x, y } })
      .then((r) => r.data),
};

export const Routing = {
  route: (body) => api.post("/routing", body).then((r) => r.data),
};

export const Stats = {
  get: () => api.get("/stats").then((r) => r.data),
};
