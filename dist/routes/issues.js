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
// src/routes/issueRouter.ts
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const db_1 = __importDefault(require("../db"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const ai_1 = require("../utils/ai");
const cloudinary_1 = require("../utils/cloudinary");
dotenv_1.default.config();
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)();
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return res.status(401).json({ error: "No token" });
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "supersecretkey");
        req.user = decoded;
        next();
    }
    catch (_a) {
        res.status(401).json({ error: "Invalid token" });
    }
}
function verifyAuthority(req, res, next) {
    if (!req.user)
        return res.status(401).json({ error: "Unauthorized" });
    if (!req.user.authorityId)
        return res.status(403).json({ error: "Forbidden: Authority only" });
    next();
}
function verifyAdmin(req, res, next) {
    // First, make sure the token is already verified
    if (!req.user)
        return res.status(401).json({ error: "Unauthorized" });
    // Check the role
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admins only" });
    }
    next();
}
router.get("/me", verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const user = yield db_1.default.user.findUnique({
            where: { id: userId },
            include: { authority: true }
        });
        if (!user)
            return res.status(404).json({ error: "User not found" });
        if (!user.authority)
            return res.status(403).json({ error: "User has no authority assigned" });
        res.json({
            authorityId: user.authority.id,
            authorityName: user.authority.name,
            category: user.authority.level
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
}));
router.patch("/:id/status", verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const issueId = parseInt(req.params.id);
        const { status } = req.body;
        const allowedStatuses = ["pending", "in-progress", "resolved"];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        // Fetch the issue
        const issue = yield db_1.default.issue.findUnique({
            where: { id: issueId },
        });
        if (!issue) {
            return res.status(404).json({ error: "Issue not found" });
        }
        // Check authority
        if (issue.currentAuthorityId !== req.user.authorityId) {
            return res.status(403).json({ error: "You are not allowed to update this issue" });
        }
        // Update status
        const updatedIssue = yield db_1.default.issue.update({
            where: { id: issueId },
            data: { status },
        });
        res.json({
            message: "Issue status updated successfully",
            issue: updatedIssue,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
}));
router.get("/admin/issues", verifyToken, verifyAdmin, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const issues = yield db_1.default.issue.findMany({
            include: { user: true, issueType: true, currentAuthority: true },
            orderBy: { createdAt: "desc" },
        });
        res.json(issues);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
}));
router.get("/authority", verifyToken, verifyAuthority, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const authorityId = req.user.authorityId;
    const issues = yield db_1.default.issue.findMany({
        where: { currentAuthorityId: authorityId },
        include: { user: true, issueType: true },
        orderBy: { createdAt: "desc" },
    });
    res.json(issues);
}));
router.post("/", verifyToken, upload.single("image"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (!req.file)
            return res.status(400).json({ error: "Image file is required" });
        // Upload image to Cloudinary
        const uploadResult = yield (0, cloudinary_1.uploadBufferToCloudinary)(req.file.buffer, "civic_issues");
        const imageUrl = uploadResult.secure_url;
        // Map category -> issueType (if category provided)
        let issueTypeRecord = null;
        if (req.body.category) {
            issueTypeRecord = yield db_1.default.issueType.findUnique({
                where: { name: req.body.category },
            });
        }
        // Determine authority based on issueType
        let authorityRecord = null;
        if (issueTypeRecord === null || issueTypeRecord === void 0 ? void 0 : issueTypeRecord.authority) {
            authorityRecord = yield db_1.default.authority.findFirst({
                where: { name: { contains: issueTypeRecord.authority, mode: "insensitive" } },
            });
        }
        const issue = yield db_1.default.issue.create({
            data: {
                title: req.body.title || "Untitled",
                description: req.body.description || "",
                category: req.body.category || "General",
                imageUrl,
                userId: req.user.id,
                issueTypeId: (_a = issueTypeRecord === null || issueTypeRecord === void 0 ? void 0 : issueTypeRecord.id) !== null && _a !== void 0 ? _a : null,
                currentAuthorityId: (_b = authorityRecord === null || authorityRecord === void 0 ? void 0 : authorityRecord.id) !== null && _b !== void 0 ? _b : null,
                status: "Pending", // Always Pending on user submit
            },
            include: {
                issueType: true,
                currentAuthority: true,
                user: { select: { id: true, name: true, email: true } },
            },
        });
        res.status(201).json({ message: "Issue created", issue });
    }
    catch (err) {
        console.error("Error creating issue:", err);
        res.status(500).json({ error: "Server error" });
    }
}));
router.post("/classify", verifyToken, upload.single("image"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file)
            return res.status(400).json({ error: "Image file is required" });
        // Run AI classification
        const aiResult = yield (0, ai_1.classifyIssueWithAI)(req.file.buffer);
        // Return the AI result directly
        res.status(200).json({
            title: aiResult.title || "Spam Report",
            description: aiResult.description || "",
            category: aiResult.category || "Spam",
        });
    }
    catch (err) {
        console.error("Error classifying image:", err);
        res.status(500).json({ error: "Server error" });
    }
}));
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const issues = yield db_1.default.issue.findMany();
    res.json(issues);
}));
router.get("/user", verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const issues = yield db_1.default.issue.findMany({
            where: { userId: req.user.id },
            include: { currentAuthority: true, issueType: true },
            orderBy: { createdAt: "desc" },
        });
        res.json(issues);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
}));
router.delete("/:id", verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        const deleted = yield db_1.default.issue.deleteMany({
            where: { id, userId: req.user.id },
        });
        if (deleted.count === 0)
            return res.status(404).json({ error: "Issue not found or unauthorized" });
        res.json({ message: "Issue deleted" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
}));
router.get("/authority", verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // ensure the token carries authorityId (set at login)
        const authorityId = req.user.authorityId;
        if (!authorityId)
            return res.status(403).json({ error: "User is not an authority" });
        const issues = yield db_1.default.issue.findMany({
            where: { currentAuthorityId: authorityId },
            include: { user: true, issueType: true },
            orderBy: { createdAt: "desc" },
        });
        res.json(issues);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
}));
router.patch("/:id/status", verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authorityId = req.user.authorityId;
        if (!authorityId)
            return res.status(403).json({ error: "User is not an authority" });
        const id = Number(req.params.id);
        const { status } = req.body;
        const allowed = ["Pending", "In Progress", "Resolved", "Escalated", "Spam"];
        if (!allowed.includes(status))
            return res.status(400).json({ error: "Invalid status" });
        const updated = yield db_1.default.issue.updateMany({
            where: { id, currentAuthorityId: authorityId },
            data: { status },
        });
        if (updated.count === 0)
            return res.status(404).json({ error: "Issue not found or unauthorized" });
        if (status === "Escalated") {
            const issue = yield db_1.default.issue.findUnique({ where: { id } });
            if (issue === null || issue === void 0 ? void 0 : issue.currentAuthorityId) {
                const currentAuth = yield db_1.default.authority.findUnique({ where: { id: issue.currentAuthorityId } });
                if (currentAuth === null || currentAuth === void 0 ? void 0 : currentAuth.parentId) {
                    yield db_1.default.issue.update({ where: { id }, data: { currentAuthorityId: currentAuth.parentId } });
                }
            }
        }
        res.json({ message: "Status updated" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
}));
router.get("/", verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.user.role !== "admin")
            return res.status(403).json({ error: "Unauthorized" });
        const issues = yield db_1.default.issue.findMany({
            include: { user: true, issueType: true, currentAuthority: true },
            orderBy: { createdAt: "desc" },
        });
        res.json(issues);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
}));
exports.default = router;
