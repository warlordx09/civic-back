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
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const issues_1 = __importDefault(require("./routes/issues"));
const cors_1 = __importDefault(require("cors"));
const db_1 = __importDefault(require("./db"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
}));
console.log("bunty");
app.use("/api/auth", auth_1.default);
app.use("/api/issues", issues_1.default);
app.get("/authorities", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('oh yeah');
    try {
        const authorities = yield db_1.default.authority.findMany({
            select: {
                id: true,
                name: true,
                level: true,
                parentId: true,
            },
            orderBy: { level: "asc" },
        });
        res.json(authorities);
    }
    catch (err) {
        console.error("Error fetching authorities:", err);
        res.status(500).json({ error: "Server error" });
    }
}));
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on oh port ${PORT}`));
