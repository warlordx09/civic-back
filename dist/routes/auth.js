"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/authRouter.ts
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../db"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const router = (0, express_1.Router)();
// signup (optionally create authority users by admin)
router.post("/signup", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, password, role, authorityId } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ error: "All fields are required" });
        const existingUser = yield db_1.default.user.findUnique({ where: { email } });
        if (existingUser)
            return res.status(400).json({ error: "Email already registered" });
        // password stored as plain text
        const result = yield db_1.default.user.create({
            data: {
                name,
                email,
                password, // no hashing
                role: role || "user", // default to "user"
                authorityId: authorityId || null // only for authorities
            },
            select: { id: true, name: true, email: true, role: true, authorityId: true },
        });
        res.status(201).json({ message: "Signup successful", user: result });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
}));
router.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { email, password } = req.body;
        console.log(email, password);
        const all = yield db_1.default.user.findMany();
        console.log("all", all);
        const user = yield db_1.default.user.findUnique({ where: { email } });
        console.log("the user", user);
        if (!user)
            return res.status(400).json({ error: "Invalid email or password" });
        // compare plain text password
        if (password !== user.password)
            return res.status(400).json({ error: "Invalid email or password" });
        const payload = {
            id: user.id,
            role: user.role,
            email: user.email,
        };
        if (user.authorityId)
            payload.authorityId = user.authorityId;
        const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET || "supersecretkey", { expiresIn: "1d" });
        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                authorityId: (_a = user.authorityId) !== null && _a !== void 0 ? _a : null,
            },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
}));
exports.default = router;
