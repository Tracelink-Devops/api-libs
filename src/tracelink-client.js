/**
 * Tracelink API Client
 * A Node.js library for interfacing with Tracelink's REST API
 * 
 * @see https://tracelink.dk/api-doc/
 */

const BASE_URL = 'https://tracelink.app/rest';

class TracelinkClient {
  /**
   * Create a new Tracelink API client
   * @param {Object} config - Configuration options
   * @param {string} config.access_token - The API access token
   * @param {string} [config.base_url='https://tracelink.app/rest'] - REST base URL, for tenant-specific hosts
   * @param {string} [config.format='json'] - Response format ('json' or 'xml')
   * @param {string} [config.charset='UTF-8'] - Character set ('UTF-8' or 'CP850')
   */
  constructor(config) {
    if (!config?.access_token) {
      throw new Error('access_token is required');
    }

    this.access_token = config.access_token;
    this.base_url = (config.base_url || BASE_URL).replace(/\/+$/, '');
    this.format = config.format || 'json';
    this.charset = config.charset || 'UTF-8';
    
    // Initialize sub-clients
    this.company = new CompanyClient(this);
    this.user = new UserClient(this);
    this.order = new OrderClient(this);
    this.suborder = new SuborderClient(this);
    this.object = new ObjectClient(this);
    this.util = new UtilClient(this);
  }

  /**
   * Make a request to the Tracelink API
   * @param {string} endpoint - API endpoint
   * @param {Object} [body] - Request body
   * @param {Object} [options] - Additional options
   * @param {string} [options.idempotency_key] - Idempotency key for safe retries
   * @returns {Promise<Object>} API response
   */
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

    // Check for cached response (idempotency)
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

/**
 * Custom error class for Tracelink API errors
 */
class TracelinkError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'TracelinkError';
    this.code = code;
  }
}

/**
 * Build order object for sorting, filtering, and paging
 */
function buildOrderParams(options = {}) {
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

/**
 * Company endpoints client
 */
class CompanyClient {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get master data of the current company
   * @returns {Promise<Object>}
   */
  async get() {
    return this.client.request('/company');
  }

  /**
   * Get all departments
   * @param {Object} [options] - Sorting/filtering options
   * @returns {Promise<Object>}
   */
  async listDepartments(options = {}) {
    return this.client.request('/company/dept/list', buildOrderParams(options));
  }
}

/**
 * User endpoints client
 */
class UserClient {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get current login user
   * @returns {Promise<Object>}
   */
  async get() {
    return this.client.request('/user');
  }

  /**
   * Get all users
   * @param {Object} [options] - Sorting/filtering options
   * @returns {Promise<Object>}
   */
  async list(options = {}) {
    return this.client.request('/user/list', buildOrderParams(options));
  }

  /**
   * Get all user groups
   * @param {Object} [options] - Sorting/filtering options
   * @returns {Promise<Object>}
   */
  async listGroups(options = {}) {
    return this.client.request('/user/group/list', buildOrderParams(options));
  }
}

/**
 * Order endpoints client
 */
class OrderClient {
  constructor(client) {
    this.client = client;
  }

  /**
   * Create a new Tracelink order
   * @param {Object} data - Order data
   * @param {Object} [options] - Request options
   * @returns {Promise<Object>}
   */
  async create(data, options = {}) {
    return this.client.request('/tracelink/order/create', { object: data }, options);
  }

  /**
   * Create a new order with auto-numbering
   * @param {Object} data - Order data
   * @param {number} [number_begin=1000] - Starting number
   * @param {number} [number_offset=1] - Increment between numbers
   * @param {Object} [options] - Request options
   * @returns {Promise<Object>}
   */
  async createAutoNumbered(data, number_begin = 1000, number_offset = 1, options = {}) {
    const order_data = {
      ...data,
      use_numbering: 1,
      number_begin,
      number_offset,
    };
    return this.client.request('/tracelink/order/create', { object: order_data }, options);
  }

  /**
   * Get a specific order by ID
   * @param {number|string} order_id - Order ID
   * @returns {Promise<Object>}
   */
  async get(order_id) {
    return this.client.request(`/tracelink/order/${order_id}`);
  }

  /**
   * List all orders
   * @param {Object} [options] - Sorting/filtering/paging options
   * @returns {Promise<Object>}
   */
  async list(options = {}) {
    return this.client.request('/tracelink/order/list', buildOrderParams(options));
  }

  /**
   * Update an existing order
   * @param {number|string} order_id - Order ID
   * @param {Object} data - Fields to update
   * @param {Object} [options] - Request options
   * @returns {Promise<Object>}
   */
  async update(order_id, data, options = {}) {
    return this.client.request(`/tracelink/order/update/${order_id}`, {
      object: data
    }, options);
  }

  /**
   * Delete an order
   * @param {number|string} order_id - Order ID
   * @returns {Promise<Object>}
   */
  async delete(order_id) {
    return this.client.request('/tracelink/order/update', {
      object: { order_id, xdelete: '1' }
    });
  }

  /**
   * Upload a document to an order
   * @param {number|string} order_id - Order ID
   * @param {Object} document - Document data
   * @param {string} document.data - Base64 encoded document data
   * @param {string} document.filename - Document filename
   * @param {string} [document.type] - File extension (e.g., 'png', 'pdf')
   * @returns {Promise<Object>}
   */
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

  /**
   * Add a module entry to an order
   * @param {string} module_name - Module name (e.g., 'timereg')
   * @param {Object} data - Module entry data (must include order_id)
   * @param {Object} [options] - Request options
   * @returns {Promise<Object>}
   */
  async addModule(module_name, data, options = {}) {
    return this.client.request(`/tracelink/order/add/object/module/${module_name}`, {
      object: data
    }, options);
  }

  /**
   * List module entries for an order
   * @param {string} module_name - Module name
   * @param {number|string} [order_id] - Order ID (optional)
   * @param {number|string} [order_sub_id] - Suborder ID (optional)
   * @param {Object} [options] - Sorting/filtering options
   * @returns {Promise<Object>}
   */
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

  /**
   * Update a module entry on an order
   * @param {string} module_name - Module name
   * @param {Object} data - Update data (must include module ID)
   * @param {Object} [options] - Request options
   * @returns {Promise<Object>}
   */
  async updateModule(module_name, data, options = {}) {
    return this.client.request(`/tracelink/order/update/object/module/${module_name}`, {
      object: data
    }, options);
  }

  /**
   * Delete a module entry from an order
   * @param {string} module_name - Module name
   * @param {string} id_field - ID field name (e.g., 'timereg_id')
   * @param {number|string} id_value - ID value
   * @returns {Promise<Object>}
   */
  async deleteModule(module_name, id_field, id_value) {
    return this.client.request(`/tracelink/order/update/object/module/${module_name}`, {
      object: { [id_field]: id_value, xdelete: '1' }
    });
  }
}

/**
 * Suborder endpoints client
 */
class SuborderClient {
  constructor(client) {
    this.client = client;
  }

  /**
   * Create a new suborder
   * @param {number|string} parent_order_id - Parent order ID
   * @param {Object} data - Suborder data
   * @param {Object} [options] - Request options
   * @returns {Promise<Object>}
   */
  async create(parent_order_id, data, options = {}) {
    return this.client.request('/tracelink/suborder/create', {
      object: { parent_id: parent_order_id, ...data }
    }, options);
  }

  /**
   * Get a specific suborder by ID
   * @param {number|string} order_sub_id - Suborder ID
   * @returns {Promise<Object>}
   */
  async get(order_sub_id) {
    return this.client.request(`/tracelink/suborder/${order_sub_id}`);
  }

  /**
   * List all suborders
   * @param {Object} [options] - Sorting/filtering/paging options
   * @returns {Promise<Object>}
   */
  async list(options = {}) {
    return this.client.request('/tracelink/suborder/list', buildOrderParams(options));
  }

  /**
   * Update an existing suborder
   * @param {number|string} order_sub_id - Suborder ID
   * @param {Object} data - Fields to update
   * @param {Object} [options] - Request options
   * @returns {Promise<Object>}
   */
  async update(order_sub_id, data, options = {}) {
    return this.client.request(`/tracelink/suborder/update/${order_sub_id}`, {
      object: data
    }, options);
  }

  /**
   * Delete a suborder
   * @param {number|string} order_sub_id - Suborder ID
   * @returns {Promise<Object>}
   */
  async delete(order_sub_id) {
    return this.client.request('/tracelink/suborder/update', {
      object: { order_sub_id, xdelete: '1' }
    });
  }
}

/**
 * Module object endpoints client
 */
class ObjectClient {
  constructor(client) {
    this.client = client;
  }

  /**
   * Create a new tag ID (for QR-code modules)
   * @param {number} [count=1] - Number of tags to create
   * @param {string} product_id - Product ID
   * @returns {Promise<Object>}
   */
  async createTag(product_id, count = 1) {
    return this.client.request('/object/create', {
      object: { count, product_id }
    });
  }

  /**
   * Create a new module object
   * @param {string} module_name - Module name (e.g., 'purchase', 'genobj')
   * @param {Object} data - Object data
   * @param {Object} [options] - Request options
   * @returns {Promise<Object>}
   */
  async create(module_name, data, options = {}) {
    return this.client.request(`/object/create/${module_name}`, {
      object: data
    }, options);
  }

  /**
   * Get a specific module object by ID
   * @param {string} module_name - Module name
   * @param {number|string} id - Object ID
   * @param {Object} [options] - Request options
   * @param {string|string[]} [options.expand] - Subtable(s) to include inline, e.g. 'line,journal' or ['line', 'journal']
   * @returns {Promise<Object>}
   */
  async get(module_name, id, options = {}) {
    let endpoint = `/object/list/module/${module_name}/${id}`;
    if (options.expand) {
      const expand = Array.isArray(options.expand) ? options.expand.join(',') : options.expand;
      endpoint += `?$expand=${encodeURIComponent(expand)}`;
    }
    return this.client.request(endpoint);
  }

  /**
   * List module objects
   * @param {string} module_name - Module name
   * @param {Object} [options] - Sorting/filtering/paging options
   * @returns {Promise<Object>}
   */
  async list(module_name, options = {}) {
    return this.client.request(`/object/list/module/${module_name}`, buildOrderParams(options));
  }

  /**
   * Update a module object. Supports two forms:
   *  - `update(module_name, id, data, options)` - id sent in the URL path (preferred)
   *  - `update(module_name, data, options)` - id embedded in `data` (legacy form)
   * @param {string} module_name - Module name
   * @param {number|string|Object} id_or_data - Object ID, or the full update data with the ID embedded (legacy form)
   * @param {Object} [data] - Fields to update, when `id_or_data` is an ID
   * @param {Object} [options] - Request options
   * @returns {Promise<Object>}
   */
  async update(module_name, id_or_data, data, options = {}) {
    let id;
    if (typeof id_or_data === 'object' && id_or_data !== null) {
      // legacy form: update(module_name, data, options)
      options = data || {};
      data = id_or_data;
    } else {
      id = id_or_data;
    }

    const endpoint = id !== undefined
      ? `/object/update/${module_name}/${id}`
      : `/object/update/${module_name}`;

    return this.client.request(endpoint, { object: data }, options);
  }

  /**
   * Delete a module object
   * @param {string} module_name - Module name
   * @param {string} id_field - ID field name (e.g., 'purchase_id')
   * @param {number|string} id_value - ID value
   * @returns {Promise<Object>}
   */
  async delete(module_name, id_field, id_value) {
    return this.client.request(`/object/update/${module_name}`, {
      object: { [id_field]: id_value, xdelete: '1' }
    });
  }

  /**
   * Upload a document to a module object
   * @param {string} module_name - Module name
   * @param {string} id_field - ID field name
   * @param {number|string} id_value - ID value
   * @param {Object} document - Document data
   * @param {string} document.data - Base64 encoded document data
   * @param {string} document.filename - Document filename
   * @param {string} [document.type] - File extension
   * @returns {Promise<Object>}
   */
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

  /**
   * Create a module-to-module relation
   * @param {string} from_module - Source module name
   * @param {string} to_module - Target module name
   * @param {Object} data - Relation data
   * @param {Object} [options] - Request options
   * @returns {Promise<Object>}
   */
  async createRelation(from_module, to_module, data, options = {}) {
    return this.client.request(`/object/module/create/${from_module}/to/${to_module}`, {
      object: data
    }, options);
  }

  /**
   * List module-to-module relations
   * @param {string} from_module - Source module name
   * @param {string} to_module - Target module name
   * @param {number|string} [to_module_id] - Target module ID (optional)
   * @param {Object} [options] - Sorting/filtering options
   * @returns {Promise<Object>}
   */
  async listRelations(from_module, to_module, to_module_id, options = {}) {
    let endpoint = `/object/module/list/${from_module}/to/${to_module}`;
    if (to_module_id) {
      endpoint += `/${to_module_id}`;
    }
    return this.client.request(endpoint, buildOrderParams(options));
  }

  /**
   * Update a module-to-module relation
   * @param {string} from_module - Source module name
   * @param {string} to_module - Target module name
   * @param {Object} data - Update data
   * @param {Object} [options] - Request options
   * @returns {Promise<Object>}
   */
  async updateRelation(from_module, to_module, data, options = {}) {
    return this.client.request(`/object/module/update/${from_module}/to/${to_module}`, {
      object: data
    }, options);
  }

  /**
   * Delete a module-to-module relation
   * @param {string} from_module - Source module name
   * @param {string} to_module - Target module name
   * @param {string} id_field - Relation ID field name
   * @param {number|string} id_value - Relation ID value
   * @returns {Promise<Object>}
   */
  async deleteRelation(from_module, to_module, id_field, id_value) {
    return this.client.request(`/object/module/update/${from_module}/to/${to_module}`, {
      object: { [id_field]: id_value, xdelete: '1' }
    });
  }
}

/**
 * Utility endpoints client
 */
class UtilClient {
  constructor(client) {
    this.client = client;
  }

  /**
   * List documents for a module
   * @param {string} module_name - Module name
   * @param {Object} [options] - Sorting/filtering options
   * @returns {Promise<Object>}
   */
  async listDocuments(module_name, options = {}) {
    return this.client.request(`/util/doc/list/module/${module_name}`, buildOrderParams(options));
  }
}

// Export everything
module.exports = {
  TracelinkClient,
  TracelinkError,
  buildOrderParams,
};
