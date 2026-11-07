import { Prisma } from "@prisma/client";

// Cancels an order and puts the items back in stock. Must run inside a transaction.
export async function cancelOrderTx(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true },
  });
  for (const item of order.items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
  return tx.order.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
    include: { items: true },
  });
}
