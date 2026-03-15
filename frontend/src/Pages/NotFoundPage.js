import "./Styling.css"
import {Link} from "react-router-dom";
import Homepage from "./Homepage";
function StudentHomepage() {



    return(
        <div>
            <h1 className="header">Error 404: Page not found</h1>
            <Link to= '/'>Back To Homepage</Link>
        </div>
    );
}
export default StudentHomepage