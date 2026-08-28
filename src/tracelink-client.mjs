/**
 * Tracelink API Client (ESM)
 * A Node.js library for interfacing with Tracelink's REST API
 * 
 * @see https://tracelink.dk/api-doc/
 */

const BASE_URL = 'https://tracelink.app/rest';

export class TracelinkClient {
  constructor(config) {
    if (!config?.access_token) {
      throw new Error('access_token is required');
    }
    
    this.access_token = config.access_token;
    this.base_url = (config.base_url || BASE_URL).replace(/\/+$/, '');
    this.format = config.format || 'json';
    this.charset = config.charset || 'UTF-8';
    
    this.company = new CompanyClient(this);
    this.user = new UserClient(this);
    this.order = new OrderClient(this);
    this.suborder = new SuborderClient(this);
    this.object = new ObjectClient(this);
    this.util = new UtilClient(this);
  }

  async request(endpoint, body = {}, options = {}) {
    const url = `${this.base_url}${endpoint}`;
    
    const headers = {
      'x-access-token': this.access_token,
      'Content-Type': 'application/json',
      'Accept': this.format === 'xml' ? 'application/xml' : 'application/json',
    };

    if (this.charset === 'CP850') {
      headers['X-Charset'] = 'CP850';
    }

    if (options.idempotency_key) {
      headers['Idempotency-Key'] = options.idempotency_key;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const raw = await response.text();

    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = undefined;
    }

    // Some endpoints answer HTTP 500 with a completely empty body (e.g. modules
    // without a generic object endpoint). Surface that as a TracelinkError
    // instead of letting JSON.parse throw a bare SyntaxError.
    if (data === null || typeof data !== 'object') {
      const error = new TracelinkError(
        `Non-JSON response (HTTP ${response.status}) from ${endpoint}` +
          (raw ? `: ${raw.slice(0, 200)}` : ' (empty body)'),
        response.status
      );
      error.http_status = response.status;
      error.empty_body = raw === '';
      error.raw_body = raw;
      throw error;
    }

    const cached_key = response.headers.get('X-ResultFromCache');
    if (cached_key) {
      data._cached = true;
      data._idempotency_key = cached_key;
    }

    if (!response.ok || data.status === 'error') {
      const error = new TracelinkError(
        data.message || `HTTP ${response.status} from ${endpoint}${raw ? '' : ' (empty body)'}`,
        data.code ?? response.status
      );
      error.response = data;
      error.http_status = response.status;
      error.empty_body = raw === '';
      throw error;
    }

    return data;
  }
}

export class TracelinkError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'TracelinkError';
    this.code = code;
  }
}

export function buildOrderParams(options = {}) {
  const order = {};

  if (options.sort) {
    order.sort = Array.isArray(options.sort) ? options.sort.join(',') : options.sort;
  }

  if (options.reverse) {
    order.reverse = 1;
  }

  if (options.limit !== undefined) {
    order.limit = options.limit;
  }

  if (options.page !== undefined) {
    order.page = options.page;
  }

  if (options.filter) {
    order.filter = options.filter;
  }

  if (options.filter_or) {
    order.filter_or = true;
  }

  return Object.keys(order).length > 0 ? { order } : {};
}

class CompanyClient {
  constructor(client) {
    this.client = client;
  }

  async get() {
    return this.client.request('/company');
  }

  async listDepartments(options = {}) {
    return this.client.request('/company/dept/list', buildOrderParams(options));
  }
}

class UserClient {
  constructor(client) {
    this.client = client;
  }

  async get() {
    return this.client.request('/user');
  }

  async list(options = {}) {
    return this.client.request('/user/list', buildOrderParams(options));
  }

  async listGroups(options = {}) {
    return this.client.request('/user/group/list', buildOrderParams(options));
  }
}

class OrderClient {
  constructor(client) {
    this.client = client;
  }

  async create(data, options = {}) {
    return this.client.request('/tracelink/order/create', { object: data }, options);
  }

  async createAutoNumbered(data, number_begin = 1000, number_offset = 1, options = {}) {
    const order_data = {
      ...data,
      use_numbering: 1,
      number_begin,
      number_offset,
    };
    return this.client.request('/tracelink/order/create', { object: order_data }, options);
  }

  async get(order_id) {
    return this.client.request(`/tracelink/order/${order_id}`);
  }

  async list(options = {}) {
    return this.client.request('/tracelink/order/list', buildOrderParams(options));
  }

  async update(order_id, data, options = {}) {
    return this.client.request('/tracelink/order/update', {
      object: { order_id, ...data }
    }, options);
  }

  async delete(order_id) {
    return this.client.request('/tracelink/order/update', {
      object: { order_id, xdelete: '1' }
    });
  }

  async uploadDocument(order_id, document) {
    return this.client.request('/tracelink/order/update', {
      object: {
        order_id,
        image_data_encoded: document.data,
        image_description: document.filename,
        image_type: document.type,
      }
    });
  }

  async addModule(module_name, data, options = {}) {
    return this.client.request(`/tracelink/order/add/object/module/${module_name}`, {
      object: data
    }, options);
  }

  async listModule(module_name, order_id, order_sub_id, options = {}) {
    let endpoint = `/tracelink/order/list/module/${module_name}`;
    if (order_id) {
      endpoint += `/${order_id}`;
      if (order_sub_id) {
        endpoint += `/${order_sub_id}`;
      }
    }
    return this.client.request(endpoint, buildOrderParams(options));
  }

  async updateModule(module_name, data, options = {}) {
    return this.client.request(`/tracelink/order/update/object/module/${module_name}`, {
      object: data
    }, options);
  }

  async deleteModule(module_name, id_field, id_value) {
    return this.client.request(`/tracelink/order/update/object/module/${module_name}`, {
      object: { [id_field]: id_value, xdelete: '1' }
    });
  }
}

class SuborderClient {
  constructor(client) {
    this.client = client;
  }

  async create(parent_order_id, data, options = {}) {
    return this.client.request('/tracelink/suborder/create', {
      object: { parent_id: parent_order_id, ...data }
    }, options);
  }

  async get(order_sub_id) {
    return this.client.request(`/tracelink/suborder/${order_sub_id}`);
  }

  async list(options = {}) {
    return this.client.request('/tracelink/suborder/list', buildOrderParams(options));
  }

  async update(order_sub_id, data, options = {}) {
    return this.client.request('/tracelink/suborder/update', {
      object: { order_sub_id, ...data }
    }, options);
  }

  async delete(order_sub_id) {
    return this.client.request('/tracelink/suborder/update', {
      object: { order_sub_id, xdelete: '1' }
    });
  }
}

class ObjectClient {
  constructor(client) {
    this.client = client;
  }

  async createTag(product_id, count = 1) {
    return this.client.request('/object/create', {
      object: { count, product_id }
    });
  }

  async create(module_name, data, options = {}) {
    return this.client.request(`/object/create/${module_name}`, {
      object: data
    }, options);
  }

  async get(module_name, id, options = {}) {
    let endpoint = `/object/list/module/${module_name}/${id}`;
    if (options.expand) {
      const expand = Array.isArray(options.expand) ? options.expand.join(',') : options.expand;
      endpoint += `?$expand=${encodeURIComponent(expand)}`;
    }
    return this.client.request(endpoint);
  }

  async list(module_name, options = {}) {
    return this.client.request(`/object/list/module/${module_name}`, buildOrderParams(options));
  }

  async update(module_name, data, options = {}) {
    return this.client.request(`/object/update/${module_name}`, {
      object: data
    }, options);
  }

  async delete(module_name, id_field, id_value) {
    return this.client.request(`/object/update/${module_name}`, {
      object: { [id_field]: id_value, xdelete: '1' }
    });
  }

  async uploadDocument(module_name, id_field, id_value, document) {
    return this.client.request(`/object/update/${module_name}`, {
      object: {
        [id_field]: id_value,
        image_data_encoded: document.data,
        image_description: document.filename,
        image_type: document.type,
      }
    });
  }

  async createRelation(from_module, to_module, data, options = {}) {
    return this.client.request(`/object/module/create/${from_module}/to/${to_module}`, {
      object: data
    }, options);
  }

  async listRelations(from_module, to_module, to_module_id, options = {}) {
    let endpoint = `/object/module/list/${from_module}/to/${to_module}`;
    if (to_module_id) {
      endpoint += `/${to_module_id}`;
    }
    return this.client.request(endpoint, buildOrderParams(options));
  }

  async updateRelation(from_module, to_module, data, options = {}) {
    return this.client.request(`/object/module/update/${from_module}/to/${to_module}`, {
      object: data
    }, options);
  }

  async deleteRelation(from_module, to_module, id_field, id_value) {
    return this.client.request(`/object/module/update/${from_module}/to/${to_module}`, {
      object: { [id_field]: id_value, xdelete: '1' }
    });
  }
}

class UtilClient {
  constructor(client) {
    this.client = client;
  }

  async listDocuments(module_name, options = {}) {
    return this.client.request(`/util/doc/list/module/${module_name}`, buildOrderParams(options));
  }
}

export default TracelinkClient;
