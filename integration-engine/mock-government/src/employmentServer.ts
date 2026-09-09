import express from "express";

const app = express();

app.use(express.text({ type: ["text/xml", "application/xml"] }));

app.post("/soap/employment", (req, res) => {

    const xmlResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <EmploymentResponse>
            <CitizenId>EDU1001</CitizenId>
            <Name>Rahul Kumar</Name>
            <EmploymentStatus>Employed</EmploymentStatus>
            <Company>ABC Technologies</Company>
        </EmploymentResponse>
    `;

    res.type("text/xml");
    res.send(xmlResponse);
});

app.listen(5002, () => {
    console.log("Employment SOAP server running on port 5002");
});