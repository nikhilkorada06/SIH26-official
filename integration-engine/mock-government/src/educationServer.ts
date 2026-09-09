import express from "express";

const app = express();

app.use(express.json());

const students = [
    {
        student_id: "EDU1001",
        student_name: "Rahul Kumar",
        dob: "12-04-2004",
        college: "ABC College",
        degree: "B.Tech",
        graduation_year: 2027
    },
    {
        student_id: "EDU1002",
        student_name: "Aman Singh",
        dob: "08-11-2003",
        college: "XYZ University",
        degree: "B.Tech",
        graduation_year: 2026
    }
];

app.get("/api/students/:id", (req, res) => {

    const student = students.find(
        student => student.student_id === req.params.id
    );

    if (!student) {
        return res.status(404).json({
            success: false,
            message: "Student not found"
        });
    }

    res.json(student);
});

app.listen(5001, () => {
    console.log("Mock Education API running on port 5001");
});