
import { Router } from "express";
import multer from "multer";
import prisma from "../db";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { classifyIssueWithAI, verifyImageWithText } from "../utils/ai";
import { uploadBufferToCloudinary } from "../utils/cloudinary";

dotenv.config();
const router = Router();
const upload = multer();

function verifyToken(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecretkey");
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function verifyAuthority(req: any, res: any, next: any) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  if (!req.user.authorityId)
    return res.status(403).json({ error: "Forbidden: Authority only" });

  next();
}
function verifyAdmin(req: any, res: any, next: any) {

  if (!req.user) return res.status(401).json({ error: "Unauthorized" });


  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden: Admins only" });
  }

  next();
}

router.get("/me", verifyToken, async (req: any, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { authority: true }
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.authority) return res.status(403).json({ error: "User has no authority assigned" });

    res.json({
      authorityId: user.authority.id,
      authorityName: user.authority.name,
      category: user.authority.level
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/status", verifyToken, async (req: any, res) => {
  try {
    const issueId = parseInt(req.params.id);
    const { status } = req.body;
    const allowedStatuses = ["pending", "in-progress", "resolved"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }


    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
    });

    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }


    if (issue.currentAuthorityId !== req.user.authorityId) {
      return res.status(403).json({ error: "You are not allowed to update this issue" });
    }


    const updatedIssue = await prisma.issue.update({
      where: { id: issueId },
      data: { status },
    });

    res.json({
      message: "Issue status updated successfully",
      issue: updatedIssue,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/issues", verifyToken, verifyAdmin, async (req: any, res) => {
  try {
    const issues = await prisma.issue.findMany({
      include: { user: true, issueType: true, currentAuthority: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(issues);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/authority", verifyToken, verifyAuthority, async (req: any, res) => {
  const authorityId = req.user.authorityId;
  const issues = await prisma.issue.findMany({
    where: { currentAuthorityId: authorityId },
    include: { user: true, issueType: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(issues);
});
router.post("/", verifyToken, upload.single("image"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Image file is required" });


    const uploadResult: any = await uploadBufferToCloudinary(req.file.buffer, "civic_issues");
    const imageUrl = uploadResult.secure_url;


    let issueTypeRecord = null;
    if (req.body.category) {
      issueTypeRecord = await prisma.issueType.findUnique({
        where: { name: req.body.category },
      });
    }


    let authorityRecord = null;
    if (issueTypeRecord?.authority) {
      authorityRecord = await prisma.authority.findFirst({
        where: { name: { contains: issueTypeRecord.authority, mode: "insensitive" } },
      });
    }

    const issue = await prisma.issue.create({
      data: {
        title: req.body.title || "Untitled",
        description: req.body.description || "",
        category: req.body.category || "General",
        imageUrl,
        userId: req.user.id,
        issueTypeId: issueTypeRecord?.id ?? null,
        currentAuthorityId: authorityRecord?.id ?? null,
        status: "Pending",
      },
      include: {
        issueType: true,
        currentAuthority: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json({ message: "Issue created", issue });
  } catch (err) {
    console.error("Error creating issue:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.post("/classify", verifyToken, upload.single("image"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Image file is required" });


    const aiResult = await classifyIssueWithAI(req.file.buffer);


    res.status(200).json({
      title: aiResult.title || "Spam Report",
      description: aiResult.description || "",
      category: aiResult.category || "Spam",
    });
  } catch (err) {
    console.error("Error classifying image:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/",async(req: any, res) =>{
  const issues = await prisma.issue.findMany()
    res.json(issues);

})
router.get("/user", verifyToken, async (req: any, res) => {
  try {
    const issues = await prisma.issue.findMany({
      where: { userId: req.user.id },
      include: { currentAuthority: true, issueType: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(issues);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


router.delete("/:id", verifyToken, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const deleted = await prisma.issue.deleteMany({
      where: { id, userId: req.user.id },
    });
    if (deleted.count === 0) return res.status(404).json({ error: "Issue not found or unauthorized" });
    res.json({ message: "Issue deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


router.get("/authority", verifyToken, async (req: any, res) => {
  try {

    const authorityId = req.user.authorityId;
    if (!authorityId) return res.status(403).json({ error: "User is not an authority" });

    const issues = await prisma.issue.findMany({
      where: { currentAuthorityId: authorityId },
      include: { user: true, issueType: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(issues);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/status", verifyToken, async (req: any, res) => {
  try {
    const authorityId = req.user.authorityId;
    if (!authorityId) return res.status(403).json({ error: "User is not an authority" });

    const id = Number(req.params.id);
    const { status } = req.body;
    const allowed = ["Pending", "In Progress", "Resolved", "Escalated", "Spam"];
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const updated = await prisma.issue.updateMany({
      where: { id, currentAuthorityId: authorityId },
      data: { status },
    });

    if (updated.count === 0) return res.status(404).json({ error: "Issue not found or unauthorized" });


    if (status === "Escalated") {

      const issue = await prisma.issue.findUnique({ where: { id } });
      if (issue?.currentAuthorityId) {
        const currentAuth = await prisma.authority.findUnique({ where: { id: issue.currentAuthorityId } });
        if (currentAuth?.parentId) {
          await prisma.issue.update({ where: { id }, data: { currentAuthorityId: currentAuth.parentId } });
        }
      }
    }

    res.json({ message: "Status updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


router.get("/", verifyToken, async (req: any, res) => {
  try {

    if (req.user.role !== "admin") return res.status(403).json({ error: "Unauthorized" });

    const issues = await prisma.issue.findMany({
      include: { user: true, issueType: true, currentAuthority: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(issues);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
