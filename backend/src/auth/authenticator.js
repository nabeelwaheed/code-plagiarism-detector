//Authenticates user role as actions are taken within from UI
const requireAuth = (req,res,next) => {
    const user_id = req.headers['x-user-id'];
    if (!user_id) {
        return res.status(401).json({error:"Please log in for access to modification"});
    }
    req.user = {id:user_id};
    next();
};

module.exports = {requireAuth};