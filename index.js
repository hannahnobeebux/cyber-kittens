const express = require('express');
const app = express();
const { User } = require('./db');
const { Kitten } = require('./db/Kitten.js'); 
const jwt = require('jsonwebtoken'); 

const bcrypt = require('bcrypt'); 
require("dotenv").config(); 


console.log("secret: ", process.env.SIGNING_SECRET);

// Verifies token with jwt.verify and sets req.user
// TODO - Create authentication middleware
const setUser = (req, res, next) => {
  try {
    // has the user passed in their token?
    const auth = req.header("Authorization");
  if (!auth) {
    // send the user to another part of the webpage for example 
    next(); 
    // exit if else block
    return
  } 
  // usually we have const [type, token] when destructing the token creation - we need the type 
  // in this case, we're ignoring the type, only grabbing the second part of the array 
  // we only want the token part of the header, not the type 

  // type = 'Bearer' 
  const [, token] = auth.split(" "); 
  // verifying the user token against the token from env file  
  const payload = jwt.verify(token, process.env.SIGNING_SECRET); 
  req.user = payload; 
  next(); 
  } catch (error) {
    next(error)
  }
  
}

app.use(express.json());
app.use(express.urlencoded({extended:true}));

//if there's a token, it'll be set 
app.use(setUser)

//RETURNING THE HTML WHEN ACCESSING THE ROOT ENDPOINT
app.get('/',  async (req, res, next) => {
  try {
    res.send(`
      <h1>Welcome to Cyber Kittens!</h1>
      <p>Cats are available at <a href="/kittens/1">/kittens/:id</a></p>
      <p>Create a new cat at <b><code>POST /kittens</code></b> and delete one at <b><code>DELETE /kittens/:id</code></b></p>
      <p>Log in via POST /login or register via POST /register</p>
    `);
  } catch (error) {
    console.error(error);
    next(error)
  }
});



// POST /register
// OPTIONAL - takes req.body of {username, password} and creates a new user with the hashed password
app.post("/register", setUser, async (req,res, next) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10); 
    const newUser = await User.create({username: req.body.username, password: hashedPassword}); 
    const token = jwt.sign(newUser.username, process.env.SIGNING_SECRET); 
    res.send({token: token,
      message: "success"});

    // const {username, password} = req.body; 
    // const { id } = await User.create({username, password})
    // res.sendStatus(200)

  } catch (error) {
    console.log(error); 
    next(error)
  }
  
})

// POST /login
// OPTIONAL - takes req.body of {username, password}, finds user by username, and compares the password with the hashed version from the DB
app.post("/login", setUser, async (req, res) => {
  try {
    const foundUser = await User.findOne({where: {username: req.body.username}})

    if (!foundUser) {
      res.sendStatus(401); 
    }
    const passwordsMatch = await bcrypt.compare(req.body.password, foundUser.password); 
  
    if (!passwordsMatch){
      res.sendStatus(401); 
  
    } else {
      const token = jwt.sign(foundUser.username, process.env.SIGNING_SECRET); 
      res.send({token: token, message: "success"});
    }
    
  } catch (error) {
    next(error)
  }


  
})

// GET /kittens/:id
// TODO - takes an id and returns the cat with that id
app.get("/kittens/:id", async (req, res, next) => {
  try {
    // comes from the logged in user 
    const userData = req.user; 
    if (!userData) {
      res.sendStatus(401); 
    } else if (req.params.id != userData.id) {
      res.sendStatus(401); 
    } else {
      // const kittenToFind = await Kitten.findOne({where: {ownerId: userData.id}}); 
      // return res.send(kittenToFind.toJSON())

      const {age, color, name} = await Kitten.findOne({ where: { ownerId: userData.id } })
      const clean = { age: age, color: color, name: name }
      res.send(clean)
    //   const token = jwt.sign(kittenToFind.username, process.env.SIGNING_SECRET); 

    //   if (!token) {
    //     res.sendStatus(401); 
    //     next()
    //   } else if (kittenToFind.ownerId !== req.user.id){
    //     res.sendStatus(401); 
    //     next()
    //   }
    //   else {
    //     res.send(200); 
    //   }
    //   res.send(kittenToFind.toJSON())
    }
    
  } catch (error) {
    next(error);  
  }
})

// POST /kittens
// TODO - takes req.body of {name, age, color} and creates a new cat with the given name, age, and color
app.post("/kittens", async (req, res) => {
  try {
    //only allowing authorized users to access the /kittens endpoint + viewing all kittens
    const kittenData = req.body; 
    const userData = req.user; 

    if(!userData){
      res.sendStatus(401); 
    } else {
      await Kitten.create(kittenData); 
      res.status(201).send(kittenData); 
    }
  } catch (error) {
    next()
  }

})

// DELETE /kittens/:id
// TODO - takes an id and deletes the cat with that id
app.delete("/kittens/:id", async(req, res) => {

  const userData = req.user; 
  if (!userData){
    res.sendStatus(401);
  } else if (req.params.id != userData.id){
    res.sendStatus(401); 
  } else {
      const kittenToDelete = await Kitten.findOne({where: {id: req.params.id}})
      await kittenToDelete.destroy(); 
    res.sendStatus(204)
  }
})

// error handling middleware, so failed tests receive them
app.use((error, req, res, next) => {
  console.error('SERVER ERROR: ', error);
  if(res.statusCode < 400) res.status(500);
  res.send({error: error.message, name: error.name, message: error.message});
});

// we export the app, not listening in here, so that we can run tests
module.exports = app;
