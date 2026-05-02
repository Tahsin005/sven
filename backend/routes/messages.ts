import { Router } from "express";
import { prisma } from "../db";
import { middleware, type CustomRequest } from "../middleware";

const router = Router();

// GET /messages/:messageId — get a single message (must belong to the authenticated user)
router.get("/:messageId", middleware, async (req: CustomRequest, res) => {
    try {
        const messageId = req.params.messageId as string;
        if (!messageId) {
            return res.status(400).json({ error: "Message ID is required" });
        }

        const message = await prisma.message.findUnique({
            where: {
                id: parseInt(messageId)
            },
            include: {
                conversation: true
            }
        });

        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        if (message.conversation.userId !== req.userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        res.json(message);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch message" });
    }
});

export default router;
