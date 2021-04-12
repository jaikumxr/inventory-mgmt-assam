const express = require('express')
const router = express.Router()
const User = require('../models/user')
const Alert = require('../models/alert')
const isLoggedIn = require("../middlewares/isLoggedIn")


//admin Dashboard
router.get("/dashboard", isLoggedIn, function (req, res) {
    User.find({}, function (err, users) {
        if (err) {
            console.log(err);
        } else {
            res.render("dashboard", {
                users: users,
                currentUser: req.user,
            });
        }
    });
});

router.get("/dashboard/subscriptions", isLoggedIn, function (req, res) {
    Alert.find({}, function (err, response) {
        if (err) {
            console.log(err);
        } else {
            res.render("subedit", {
                currentUser: req.user,
                subs: response
            });
        }
    });
});

router.post("/dashboard/subscriptions", isLoggedIn, function (req, res) {
    Alert.create({
        value: req.body.subname,
        type: req.body.type,
        users: [],
        items: []
    }, function (err, response) {
        if (err) {
            console.log(err);
        }
    });
    res.redirect("/dashboard/subscriptions");
});

router.delete("/dashboard/subscriptions/:id", isLoggedIn, function (req, res) {
    Alert.findByIdAndRemove(req.params.id, function (err) {
        if (err) {
            req.flash("error", "Could not remove Item/Location");
            res.redirect("/dashboard/subscriptions");
        } else {
            req.flash("success", "Removed Item/Location");
            res.redirect("/dashboard/subscriptions");
        }
    });
});

//show signup form
router.get("/dashboard/createuser", function (req, res) {
    res.render("register");
});

//handle signup logic
router.post("/dashboard/createuser", function (req, res) {

    const { username, password, email, firstName, lastName, confirmpassword } = req.body;
    let errors = [];

    if (!username || !password || !email) {
        errors.push({ msg: 'Please enter all required fields' });
    }

    var paswd = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{7,15}$/;

    if (!password.match(paswd)) {
        errors.push({ msg: "Enter a password between 7 to 15 characters which contains at least one numeric digit and a special character." });
    }

    if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
        errors.push({ msg: "Please enter a valid email" })
    }

    if (password != confirmpassword) {
        errors.push({ msg: "Both passwords are different. Kindly enter same password in the Confirm Password field." })
    }

    if (errors.length > 0) {
        req.flash("error", errors[0].msg);
        res.redirect("/dashboard/createuser");
    } else {
        var newUser = new User({
            username: req.body.username
        });
        if (req.body.role === "admin") {
            newUser.isAdmin = "true"
        }
        newUser.lastName = lastName;
        newUser.firstName = firstName;
        newUser.email = email;
        User.register(newUser, req.body.password, function (err) {
            if (err) {
                console.log(err);
                return res.redirect("/dashboard/createuser");
            }
            req.flash("success", "Successfully created user: " + req.body.username);
            res.redirect("/dashboard");
        });
    }
});

router.get("/dashboard/:id/edituser", isLoggedIn, function (req, res) {
    User.findById(req.params.id, function (err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            res.render("edit", {
                user: foundUser,
            });
        }
    });
});

router.put("/dashboard/:id", isLoggedIn, function (req, res) {

    const { username, password, email, firstName, lastName, confirmpassword } = req.body;
    let errors = [];

    if (!username || !password || !email) {
        errors.push({ msg: 'Please enter all required fields' });
    }

    var paswd = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{7,15}$/;

    if (!password.match(paswd)) {
        errors.push({ msg: "Enter a password between 7 to 15 characters which contains at least one numeric digit and a special character." });
    }

    if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
        errors.push({ msg: "Please enter a valid email" })
    }

    if (password != confirmpassword) {
        errors.push({ msg: "Both passwords are different. Kindly enter same password in the Confirm Password field." })
    }

    if (errors.length > 0) {
        req.flash("error", errors[0].msg);
        res.redirect("/dashboard/" + req.params.id + "/edituser");
    } else {
        User.findByIdAndRemove(req.params.id, function (err) {
            if (err) {
                console.log(err);
            } else {
                console.log("Updating user...");
            }
        });
        var newUser = new User({
            username: req.body.username,
            lastName: req.body.lastName,
            firstName: req.body.firstName,
            email: req.body.email,
        });
        if (req.body.role === "admin") {
            newUser.isAdmin = "true"
        }
        User.register(newUser, req.body.password, function (err) {
            if (err) {
                console.log(err);
                return res.redirect("/dashboard")
            }
            req.flash("success", "Successfully updated user: " + req.body.username);
            res.redirect("/dashboard");
        });
    }
});


//delete USER
router.delete("/dashboard/:id", isLoggedIn, function (req, res) {
    User.findByIdAndRemove(req.params.id, function (err) {
        if (err) {
            req.flash("error", "Could not remove user");
            res.redirect("/dashboard");
        } else {
            req.flash("success", "Removed user");
            res.redirect("/dashboard");
        }
    });
});


module.exports = router