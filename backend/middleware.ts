import type { NextFunction, Request, Response } from "express";
import { createSupabaseClient } from "./client";
import { prisma } from "./db";

const client = createSupabaseClient();

export interface CustomRequest extends Request {
    userId?: string;
}

export async function middleware(req: CustomRequest, res: Response, next: NextFunction) {
    const token = req.headers.authorization;

    const data = await client.auth.getUser(token);
    const userId = data.data.user?.id;
    if (userId) {
        try {
            console.log({
               id: userId,
                    email: data.data.user?.email!,
                    provider: data.data.user?.app_metadata.provider === "google" ? "google": "github",
                    name: data.data.user?.user_metadata.full_name,
                    supabaseId: userId 
            })
            await prisma.user.create({
                data: {
                    id: userId,
                    email: data.data.user!.email!,
                    provider: data.data.user?.app_metadata.provider === "google" ? "google": "github",
                    name: data.data.user?.user_metadata.full_name,
                    supabaseId: userId
                }
            })
        } catch (error) {
        }
        req.userId = userId;
        return next();
    } else {
        res.status(403).json({
            message: "Incorrect inputs"
        })
    }
}