import "./Styling.css"
import {Form, Link, useNavigate} from "react-router-dom";
import {useState} from "react";
import {checkForm} from "../Util/checkForm";
function Homepage() {
    const [name, setName] = useState('');
    const [rname, rsetName] = useState('');
    const nav = useNavigate()

    const maxTextLength = 15;

    //Check if the user is in the database upon submission
    const handleSubmit = (e) => {
        e.preventDefault();
    }
    //TODO: check the backend to see if the user is registered-----------------------------
    const goToInstrHome = () => {
        //TODO check the backend and return true/false for isRegistered--------------------
        const isRegistered = true;
        if (isRegistered){
            nav('/instructorHomepage/' + name);
        }else{
            alert('User not found. If you are a new user please sign up.')
        }
    }

    const toStudentHomepage = () => {
        //TODO check the backend and return true/false for isRegistered--------------------
        const isRegistered = true;
        if (isRegistered){
            nav('/studentHomepage/' + name);
        }else{
            alert('User not found. If you are a new user please sign up.')
        }
    }

    //TODO: add user to the backend list of users-----------------------
    const goToInstrHomeReg = () => {
        nav('/instructorHomepage/' + rname);
    }
    //navigate to the new homepage for the new user
    const toStudentHomepageReg = () => {
        nav('/studentHomepage/' + rname);
    }

    return (
        <div className={'testing'}>
            <h1 className="header">Homepage</h1>
            <br/>
            <section className={'smallContainer'}>
                <section className={'smallContainer'}>
                    <h1>Sign In</h1>
                    <form onSubmit={handleSubmit} className={'sidebarTextbox'}>
                        <label htmlFor="nameInput">Name:</label>
                        <br/>
                        <input
                            id="nameInput"
                            type="text"
                            maxLength={maxTextLength}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <br/>
                    </form>
                    <br/>
                    <br/>
                    <section className={'displStuLeft'}>
                        <button type={'button'} onClick={goToInstrHome} className={'standardButton'}>Instructor</button>
                    </section>
                    <section className={'displStuRight'}>
                        <button type={'button'} onClick={toStudentHomepage} className={'standardButton'}>Student
                        </button>
                    </section>
                    <br/>
                </section>
                <section className={'smallContainer'}>
                    <h1>Register a new user</h1>
                    <form onSubmit={handleSubmit} className={'sidebarTextbox'}>
                        <label htmlFor="nameInput">Name:</label>
                        <br/>
                        <input
                            id="nameInput"
                            type="text"
                            maxLength={maxTextLength}
                            value={rname}
                            onChange={(e) => rsetName(e.target.value)}
                        />
                        <br/>
                    </form>
                    <br/>
                    <br/>
                    <section className={'displStuLeft'}>
                        <button type={'button'} onClick={goToInstrHomeReg} className={'standardButton'}>Instructor</button>
                    </section>
                    <section className={'displStuRight'}>
                        <button type={'button'} onClick={toStudentHomepageReg} className={'standardButton'}>Student</button>
                    </section>
                </section>
            </section>
        </div>
    );
}

/*

<form onSubmit={handleSubmit} className={'sidebarTextbox'}>
                    <label htmlFor="nameInput">Name:</label>
                    <br/>
                    <input
                        id="nameInput"
                        type="text"
                        maxLength={maxTextLength}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <br/>
                </form>

<form onSubmit={handleSubmit} className={'sidebarTextbox'}>
                    <label htmlFor="nameInput">Name:</label>
                    <br/>
                    <input
                        id="nameInput"
                        type="text"
                        maxLength={maxTextLength}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <br/>
                </form>

<h1 className="header">Homepage</h1>
            <div className="testing">
                <p className={'sidebarTextbox'}>Sign In</p>
                <br/>
                <div>
                    <form onSubmit={handleSubmit}>
                        <label htmlFor="nameInput">Name:</label>
                        <input
                            id="nameInput"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <br/>
                    </form>
                    <br/>
                </div>
                <div className={'testing'}>
                    <button type={'button'} onClick={goToInstrHome} className={'standardButton'}>Instructor</button>
                    <button type={'button'} onClick={toStudentHomepage} className={'standardButton'}>Student</button>
                </div>
            </div>
 */
export default Homepage