const express = require('express');
const fileUpload = require('express-fileupload');
const app = express();
const routes = require('./src/routes'); 

const path = require('path') //Testing Backend using mock UI

app.use(express.json()); 
app.use(fileUpload());   
app.use('/api', routes);

app.use(express.static(path.join(__dirname,'public'))); //Testing Backend using mock UI

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});