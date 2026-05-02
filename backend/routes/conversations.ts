import { Router } from "express";
import { prisma } from "../db";
import { middleware, type CustomRequest } from "../middleware";

const router = Router();

// GET /conversations — list all conversations for the authenticated user
router.get("/", middleware, async (req: CustomRequest, res) => {
    try {
        const conversations = await prisma.conversation.findMany({
            where: {
                userId: req.userId
            },
            include: {
                messages: true
            }
        });
        res.json(conversations);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch conversations" });
    }
});

// GET /conversations/:conversationId — get a single conversation with messages
router.get("/:conversationId", middleware, async (req: CustomRequest, res) => {
    try {
        const conversationId = req.params.conversationId as string;
        if (!conversationId) {
            return res.status(400).json({ error: "Conversation ID is required" });
        }

        const conversation = await prisma.conversation.findUnique({
            where: {
                id: conversationId
            },
            include: {
                messages: {
                    orderBy: {
                        createdAt: 'asc'
                    }
                }
            }
        });

        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        if (conversation.userId !== req.userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        res.json(conversation);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch conversation" });
    }
});

export default router;
