const OFFER = `id sellerId sku stock condition moq price { amount currency formatted }`;

/** Every operation the SDK sends. Validated against the composed public schema in CI. */
export const Operations = {
  products: `query Products($vertical: String, $first: Int, $after: String) {
    products(vertical: $vertical, first: $first, after: $after) {
      edges { node { id title vertical offers { id } buyBox { ${OFFER} } } }
      pageInfo { hasNextPage endCursor }
    }
  }`,
  product: `query Product($id: ID!) {
    product(id: $id) { id title vertical description categoryPath attributes status offers { ${OFFER} } buyBox { ${OFFER} } }
  }`,
  verticalPacks: `query VerticalPacks { verticalPacks { id name facets variantAxes attributeSchema } }`,
  createProduct: `mutation CreateProduct($input: CreateProductInput!) {
    createProduct(input: $input) { id title vertical description categoryPath attributes status offers { ${OFFER} } buyBox { ${OFFER} } }
  }`,
  addOffer: `mutation AddOffer($productId: ID!, $input: OfferInput!) {
    addOffer(productId: $productId, input: $input) { id title vertical description categoryPath attributes status offers { ${OFFER} } buyBox { ${OFFER} } }
  }`,
} as const;
