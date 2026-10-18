const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = 3000;


if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}


const usersFile = "users.json";
const reportsFile = "reports.json";


if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, "[]");
}


if (!fs.existsSync(reportsFile)) {
    fs.writeFileSync(reportsFile, "[]");
}



app.use(express.json());

app.use(express.static(__dirname));

app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "uploads")
    )
);



const storage =
    multer.diskStorage({

        destination: function(req, file, cb) {

            cb(null, "uploads/");

        },

        filename: function(req, file, cb) {

            const name =
                Date.now() +
                "-" +
                file.originalname
                    .replace(/\s+/g, "-");

            cb(null, name);

        }

    });


const upload =
    multer({

        storage: storage,

        limits: {
            fileSize: 5 * 1024 * 1024
        },

        fileFilter: function(req, file, cb) {

            if (
                file.mimetype.startsWith("image/")
            ) {

                cb(null, true);

            } else {

                cb(
                    new Error(
                        "Only image files are allowed."
                    )
                );

            }

        }

    });



app.post(
    "/api/signup",
    async (req, res) => {

        const {
            name,
            studentId,
            email,
            password
        } = req.body;


        let users =
            JSON.parse(
                fs.readFileSync(usersFile)
            );


        const exists =
            users.find(
                user => user.email === email
            );


        if (exists) {

            return res.json({

                success: false,

                message:
                    "Email already registered."

            });

        }


        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );


        const user = {

            id: Date.now(),

            name,

            studentId,

            email,

            password: hashedPassword

        };


        users.push(user);


        fs.writeFileSync(
            usersFile,
            JSON.stringify(users, null, 2)
        );


        res.json({

            success: true,

            message:
                "Account created successfully!"

        });

    }
);



app.post(
    "/api/login",
    async (req, res) => {

        const {
            email,
            password
        } = req.body;


        const users =
            JSON.parse(
                fs.readFileSync(usersFile)
            );


        const user =
            users.find(
                user => user.email === email
            );


        if (!user) {

            return res.json({

                success: false,

                message:
                    "Invalid email or password."

            });

        }


        const correct =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!correct) {

            return res.json({

                success: false,

                message:
                    "Invalid email or password."

            });

        }


        res.json({

            success: true,

            message:
                "Login successful!",

            user: {

                name: user.name,

                studentId: user.studentId,

                email: user.email

            }

        });

    }
);



app.post(
    "/api/reports",
    upload.single("photo"),
    (req, res) => {

        try {

            const reports =
                JSON.parse(
                    fs.readFileSync(reportsFile)
                );


            const item = {

                id: Date.now(),

                type: req.body.type,

                name: req.body.name,

                category:
                    req.body.category,

                description:
                    req.body.description,

                location:
                    req.body.location,

                date:
                    req.body.date,

                photo:
                    "/uploads/" +
                    req.file.filename,

                reportedBy:
                    "Student"

            };


            reports.push(item);


            fs.writeFileSync(

                reportsFile,

                JSON.stringify(
                    reports,
                    null,
                    2
                )

            );


            res.json({

                success: true,

                message:
                    "Item reported successfully!"

            });

        }

        catch (error) {

            console.log(error);

            res.status(500).json({

                success: false,

                message:
                    "Could not save report."

            });

        }

    }
);



app.get(
    "/api/reports",
    (req, res) => {

        const reports =
            JSON.parse(
                fs.readFileSync(reportsFile)
            );


        res.json(reports);

    }
);



app.listen(
    PORT,
    () => {

        console.log(
            `Server running at http://localhost:${PORT}`
        );

    }
);