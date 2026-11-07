// OpenAPI 3 description of the API, served by Swagger UI at /api/docs

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ "application/json": { schema } });
const body = (schema: object, example?: object) => ({
  required: true,
  content: { "application/json": { schema, ...(example ? { example } : {}) } },
});
const res = (description: string, schema?: object) => ({
  description,
  ...(schema ? { content: json(schema) } : {}),
});
const list = (item: string) => ({
  type: "object",
  properties: { items: { type: "array", items: ref(item) } },
});
const paged = (item: string) => ({
  type: "object",
  properties: {
    items: { type: "array", items: ref(item) },
    total: { type: "integer" },
    page: { type: "integer" },
    limit: { type: "integer" },
    totalPages: { type: "integer" },
  },
});
const pathId = (name = "id") => ({ name, in: "path", required: true, schema: { type: "string" } });
const query = (name: string, schema: object, description?: string) => ({
  name,
  in: "query",
  required: false,
  schema,
  ...(description ? { description } : {}),
});
const secured = [{ bearerAuth: [] }];
const errors = {
  "400": res("Validation error", ref("Error")),
  "401": res("Not logged in or token expired", ref("Error")),
  "403": res("Admin access required", ref("Error")),
  "404": res("Not found", ref("Error")),
};
const only = (...codes: string[]) =>
  Object.fromEntries(Object.entries(errors).filter(([c]) => codes.includes(c)));

const productBody = {
  type: "object",
  required: ["name", "description", "priceCents", "stock", "categoryId"],
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    priceCents: { type: "integer", description: "Price in cents" },
    stock: { type: "integer" },
    imageUrl: { type: "string", nullable: true, description: "e.g. /uploads/abc.png" },
    categoryId: { type: "string" },
    isActive: { type: "boolean", default: true },
  },
};

const productListParams = [
  query("q", { type: "string" }, "Search in name and description"),
  query("category", { type: "string" }, "Category slug, e.g. electronics"),
  query("minPrice", { type: "integer" }, "In cents"),
  query("maxPrice", { type: "integer" }, "In cents"),
  query("sort", { type: "string", enum: ["newest", "price_asc", "price_desc", "name"], default: "newest" }),
  query("page", { type: "integer", default: 1 }),
  query("limit", { type: "integer", default: 12, maximum: 50 }),
];

const statusEnum = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];

export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Shop API",
    version: "1.0.0",
    description:
      "E-commerce REST API. To test protected routes: call **POST /auth/login**, copy the `accessToken` " +
      "from the response, click **Authorize** (top right) and paste it. Demo admin: admin@shop.dev / Admin12345. " +
      "All prices are integers in cents.",
  },
  servers: [{ url: "/api" }],
  tags: [
    { name: "Auth" },
    { name: "Categories" },
    { name: "Products" },
    { name: "Cart" },
    { name: "Orders" },
    { name: "Admin" },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Error: { type: "object", properties: { error: { type: "string" } } },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string" },
          name: { type: "string" },
          role: { type: "string", enum: ["USER", "ADMIN"] },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      AuthResult: {
        type: "object",
        properties: { user: ref("User"), accessToken: { type: "string" } },
      },
      Category: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" }, slug: { type: "string" } },
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
          description: { type: "string" },
          priceCents: { type: "integer" },
          stock: { type: "integer" },
          imageUrl: { type: "string", nullable: true },
          isActive: { type: "boolean" },
          categoryId: { type: "string" },
          category: ref("Category"),
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CartItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          productId: { type: "string" },
          quantity: { type: "integer" },
          product: ref("Product"),
        },
      },
      Cart: {
        type: "object",
        properties: {
          items: { type: "array", items: ref("CartItem") },
          count: { type: "integer" },
          totalCents: { type: "integer" },
        },
      },
      OrderItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          productId: { type: "string" },
          name: { type: "string" },
          unitPriceCents: { type: "integer" },
          quantity: { type: "integer" },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string", enum: statusEnum },
          totalCents: { type: "integer" },
          shippingName: { type: "string" },
          shippingPhone: { type: "string" },
          shippingAddress: { type: "string" },
          shippingCity: { type: "string" },
          shippingPostalCode: { type: "string" },
          paidAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          items: { type: "array", items: ref("OrderItem") },
        },
      },
    },
  },
  paths: {
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Create an account",
        requestBody: body(
          {
            type: "object",
            required: ["email", "password", "name"],
            properties: { email: { type: "string" }, password: { type: "string", minLength: 8 }, name: { type: "string" } },
          },
          { email: "me@example.com", password: "Password123", name: "My Name" }
        ),
        responses: { "201": res("Created", ref("AuthResult")), ...only("400"), "409": res("Email already registered", ref("Error")) },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in (returns accessToken, sets refresh cookie)",
        requestBody: body(
          {
            type: "object",
            required: ["email", "password"],
            properties: { email: { type: "string" }, password: { type: "string" } },
          },
          { email: "admin@shop.dev", password: "Admin12345" }
        ),
        responses: { "200": res("OK", ref("AuthResult")), ...only("400", "401") },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Get a new access token using the refresh cookie",
        responses: { "200": res("OK", ref("AuthResult")), ...only("401") },
      },
    },
    "/auth/logout": {
      post: { tags: ["Auth"], summary: "Clear the refresh cookie", responses: { "200": res("OK") } },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current user",
        security: secured,
        responses: {
          "200": res("OK", { type: "object", properties: { user: ref("User") } }),
          ...only("401"),
        },
      },
    },

    "/categories": {
      get: { tags: ["Categories"], summary: "List categories", responses: { "200": res("OK", list("Category")) } },
      post: {
        tags: ["Categories"],
        summary: "Create category (admin)",
        security: secured,
        requestBody: body({ type: "object", required: ["name"], properties: { name: { type: "string" } } }, { name: "Toys" }),
        responses: { "201": res("Created", ref("Category")), ...only("400", "401", "403") },
      },
    },
    "/categories/{id}": {
      patch: {
        tags: ["Categories"],
        summary: "Rename category (admin)",
        security: secured,
        parameters: [pathId()],
        requestBody: body({ type: "object", required: ["name"], properties: { name: { type: "string" } } }),
        responses: { "200": res("OK", ref("Category")), ...only("400", "401", "403", "404") },
      },
      delete: {
        tags: ["Categories"],
        summary: "Delete category (admin, must be empty)",
        security: secured,
        parameters: [pathId()],
        responses: { "204": res("Deleted"), ...only("401", "403"), "409": res("Category still has products", ref("Error")) },
      },
    },

    "/products": {
      get: {
        tags: ["Products"],
        summary: "List products with search, filters, sorting and pagination",
        parameters: productListParams,
        responses: { "200": res("OK", paged("Product")) },
      },
      post: {
        tags: ["Products"],
        summary: "Create product (admin)",
        security: secured,
        requestBody: body(productBody),
        responses: { "201": res("Created", ref("Product")), ...only("400", "401", "403") },
      },
    },
    "/products/{id}": {
      get: {
        tags: ["Products"],
        summary: "Product details (id or slug)",
        parameters: [pathId()],
        responses: { "200": res("OK", ref("Product")), ...only("404") },
      },
      patch: {
        tags: ["Products"],
        summary: "Update product (admin, any subset of fields)",
        security: secured,
        parameters: [pathId()],
        requestBody: body({ ...productBody, required: [] }),
        responses: { "200": res("OK", ref("Product")), ...only("400", "401", "403", "404") },
      },
      delete: {
        tags: ["Products"],
        summary: "Deactivate product (admin, keeps order history)",
        security: secured,
        parameters: [pathId()],
        responses: { "204": res("Deactivated"), ...only("401", "403", "404") },
      },
    },

    "/cart": {
      get: { tags: ["Cart"], summary: "Get my cart", security: secured, responses: { "200": res("OK", ref("Cart")), ...only("401") } },
      delete: { tags: ["Cart"], summary: "Empty my cart", security: secured, responses: { "200": res("OK", ref("Cart")), ...only("401") } },
    },
    "/cart/items": {
      post: {
        tags: ["Cart"],
        summary: "Add a product to the cart",
        security: secured,
        requestBody: body(
          {
            type: "object",
            required: ["productId"],
            properties: { productId: { type: "string" }, quantity: { type: "integer", default: 1 } },
          },
          { productId: "paste-a-product-id-here", quantity: 1 }
        ),
        responses: { "201": res("OK", ref("Cart")), ...only("400", "401", "404") },
      },
    },
    "/cart/items/{productId}": {
      patch: {
        tags: ["Cart"],
        summary: "Set quantity of a cart item",
        security: secured,
        parameters: [pathId("productId")],
        requestBody: body({ type: "object", required: ["quantity"], properties: { quantity: { type: "integer", minimum: 1 } } }, { quantity: 2 }),
        responses: { "200": res("OK", ref("Cart")), ...only("400", "401", "404") },
      },
      delete: {
        tags: ["Cart"],
        summary: "Remove an item from the cart",
        security: secured,
        parameters: [pathId("productId")],
        responses: { "200": res("OK", ref("Cart")), ...only("401") },
      },
    },

    "/orders": {
      post: {
        tags: ["Orders"],
        summary: "Checkout: create an order from the cart",
        security: secured,
        requestBody: body(
          {
            type: "object",
            required: ["shippingName", "shippingPhone", "shippingAddress", "shippingCity", "shippingPostalCode"],
            properties: {
              shippingName: { type: "string" },
              shippingPhone: { type: "string" },
              shippingAddress: { type: "string" },
              shippingCity: { type: "string" },
              shippingPostalCode: { type: "string" },
            },
          },
          {
            shippingName: "Demo User",
            shippingPhone: "09120000000",
            shippingAddress: "Some street, No. 1",
            shippingCity: "Tehran",
            shippingPostalCode: "1234567890",
          }
        ),
        responses: {
          "201": res("Created", ref("Order")),
          ...only("400", "401"),
          "409": res("Not enough stock", ref("Error")),
        },
      },
      get: { tags: ["Orders"], summary: "My orders", security: secured, responses: { "200": res("OK", list("Order")), ...only("401") } },
    },
    "/orders/{id}": {
      get: {
        tags: ["Orders"],
        summary: "One of my orders",
        security: secured,
        parameters: [pathId()],
        responses: { "200": res("OK", ref("Order")), ...only("401", "404") },
      },
    },
    "/orders/{id}/pay": {
      post: {
        tags: ["Orders"],
        summary: "Mock payment for a pending order",
        security: secured,
        parameters: [pathId()],
        responses: { "200": res("OK", ref("Order")), ...only("401"), "409": res("Not payable", ref("Error")) },
      },
    },
    "/orders/{id}/cancel": {
      post: {
        tags: ["Orders"],
        summary: "Cancel a pending order (restocks items)",
        security: secured,
        parameters: [pathId()],
        responses: { "200": res("OK", ref("Order")), ...only("401", "404"), "409": res("Only pending orders can be cancelled", ref("Error")) },
      },
    },

    "/admin/stats": {
      get: {
        tags: ["Admin"],
        summary: "Dashboard numbers",
        security: secured,
        responses: {
          "200": res("OK", {
            type: "object",
            properties: {
              users: { type: "integer" },
              products: { type: "integer" },
              orders: { type: "integer" },
              revenueCents: { type: "integer" },
              ordersByStatus: { type: "object", additionalProperties: { type: "integer" } },
              lowStock: { type: "array", items: { type: "object" } },
              recentOrders: { type: "array", items: { type: "object" } },
            },
          }),
          ...only("401", "403"),
        },
      },
    },
    "/admin/products": {
      get: {
        tags: ["Admin"],
        summary: "List products including inactive ones",
        security: secured,
        parameters: productListParams,
        responses: { "200": res("OK", paged("Product")), ...only("401", "403") },
      },
    },
    "/admin/orders": {
      get: {
        tags: ["Admin"],
        summary: "List all orders",
        security: secured,
        parameters: [
          query("status", { type: "string", enum: statusEnum }),
          query("page", { type: "integer", default: 1 }),
          query("limit", { type: "integer", default: 20 }),
        ],
        responses: { "200": res("OK", paged("Order")), ...only("401", "403") },
      },
    },
    "/admin/orders/{id}": {
      get: {
        tags: ["Admin"],
        summary: "Order details with customer",
        security: secured,
        parameters: [pathId()],
        responses: { "200": res("OK", ref("Order")), ...only("401", "403", "404") },
      },
    },
    "/admin/orders/{id}/status": {
      patch: {
        tags: ["Admin"],
        summary: "Change order status (PENDING → PAID → SHIPPED → DELIVERED, or CANCELLED)",
        security: secured,
        parameters: [pathId()],
        requestBody: body(
          { type: "object", required: ["status"], properties: { status: { type: "string", enum: statusEnum } } },
          { status: "SHIPPED" }
        ),
        responses: { "200": res("OK", ref("Order")), ...only("400", "401", "403", "404"), "409": res("Invalid status change", ref("Error")) },
      },
    },
    "/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "List users",
        security: secured,
        responses: { "200": res("OK", list("User")), ...only("401", "403") },
      },
    },
    "/admin/uploads": {
      post: {
        tags: ["Admin"],
        summary: "Upload a product image (png, jpg, webp, gif, max 2 MB)",
        security: secured,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["image"],
                properties: { image: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: {
          "201": res("Uploaded", { type: "object", properties: { url: { type: "string" } } }),
          ...only("400", "401", "403"),
        },
      },
    },
  },
};
