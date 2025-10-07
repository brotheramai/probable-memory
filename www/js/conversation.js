const dbname = "act";
const cnvname = "conversations";
const cnv_param = "cnv";

var db

var storyContainer;
var story;
var modules = {};
var cnv;
var cnvid;

var newCnvReq;
var pendingSaveRequest = false;

document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    // Cordova is now initialized. Have fun!

    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    initialize('story');    
}

function initialize(id){
    var req = window.indexedDB.open(dbname,3);
    req.onsuccess = e =>{
        console.log('db open');
        db = req.result 
        beginConversation(id);
    }
    req.onupgradeneeded = e =>{
        d = e.target.result;
        db.deleteObjectStore(cnvname);
        const cnvs = db.createObjectStore(cnvname, { autoIncrement: true});
    }
}

function beginConversation(id){
    storyContainer = document.getElementById(id);
    const params = new URLSearchParams(window.location.search);
    var sel = document.getElementById("contact");
    var topic = document.getElementById("topic");
    //start a new conversation
    if(!params.has(cnv_param)){
        for(var i=0; i<localStorage.length; i++){
            var k = localStorage.key(i);
            var o = document.createElement("option");
            o.value = k;
            o.innerText = k;
            sel.appendChild(o);
        }
        sel.addEventListener("change",function(e){
            console.log(`loading ${e.target.value}`)
            createConversation(e.target.value,topic.value);
            loadStory(e.target.value);
        });
    }
    //load existing conversation
    else{
        const trans = db.transaction([cnvname]);
        cnvid = parseInt(params.get(cnv_param));
        console.log(`loading cnv ${cnvid}`)
        var req = trans.objectStore(cnvname).get(cnvid);
        req.onsuccess = e => {
            cnv = e.target.result;
            var o = document.createElement("option");
            o.value = cnv.contact;
            o.innerText = cnv.contact;
            o.setAttribute("selected","");
            sel.appendChild(o);
            sel.setAttribute("disabled","");
            topic.value = cnv.topic;
            topic.addEventListener("change",function(e){
                cnv.topic = e.target.value;
                save();
            });
            cnv.history.forEach(h=>{
                var p = createStoryLine(h.p,true);
                console.log(p);
                p.classList.add(h.bot?'bot':'user');
                storyContainer.appendChild(p);
            })
            loadStory(cnv.contact);
        }
    }
}

function createConversation(contact,topic){
    cnv = { 
        topic : topic,
        contact : contact,
        history : [],
        state : '',
        data : {},
        ink_data : {}
    }
    const trans = db.transaction([cnvname],"readwrite");
    console.log('saving new cnv');
    var req = trans.objectStore(cnvname).add(cnv);
    newCnvReq = req;
    req.onsuccess = e =>{
        console.log(e);
        cnvid = e.target.result;
        newCnvReq = undefined;
        if(pendingSaveRequest){
            save();
        }
        console.log(cnvid);
    }
    req.onerror = e =>{
        console.log(e);
    }
}

function loadStory(module){
    current = localStorage.getItem(module);//modules[module];
    story = new inkjs.Story(current);
    console.log(cnv.ink_data);
    //load ink variables
    for(var k in cnv.ink_data){
        if(cnv.ink_data.hasOwnProperty(k)){
            console.log(k);
            console.log(cnv.ink_data[k]);
            story.variablesState.SetGlobal(k,cnv.ink_data[k]);
        }
    }
    if(cnv.state !== ''){
        console.log('loading state');
        story.state.LoadJson(cnv.state);
    }

    continueStory();

}

function createStoryLine(text,keepOutOfHistory=false){
    /*
    <p class='story-line'>${text}</p>
    */
    var p = document.createElement('p');
    p.clacsName = 'story-line';
    p.innerText = text;
    if(!keepOutOfHistory){
        cnv.history.push(
            {
                bot: true,
                p: text
            }
        );
    }
    return p;
}

function createOptions(choices,click,keepOutOfHistory=false){
    /*
    <ul class='choices'>
        ... options go here
    </ul>
    */
    var container = document.createElement('ul');
    container.className='choices';
    var finalClick = click;
    choices.forEach(c => {
        if(!keepOutOfHistory){
            finalClick = function(e){
                cnv.history.push({
                    bot: false,
                    p: c.text
                })
                click(e);
            }
        }
        container.appendChild(createOption(c.text,c.index,finalClick));
    });
    return container;  
}

function createOption(text,index,click){
    /*
    <li>
        <button class="choice" onclick=${click} value="${text}" data-index="${index}">${text}</button>
    </li>
    */
    var li = document.createElement('li');
    var b = document.createElement("button");
    b.className='choice';
    b.value = text;
    b.innerText = text;
    b.setAttribute('data-index',index);
    li.appendChild(b);
    if(click){
        b.addEventListener("click",click);
    }
    return li;
}


function createList(choices,click){
    /*
    <ul class='list'>
        ... options go here
    </ul>
    */
    var container = document.createElement('ul');
    container.className='choices';
    choices.forEach(c => {
        container.appendChild(createOption(c,0,click));
    });
    return container;  
}

function save(){
    if(newCnvReq !== undefined){
        console.log('pending save');
        pendingSaveRequest = true;
        return;
    }
    const trans = db.transaction([cnvname],'readwrite');
    console.log(`saving cnv ${cnvid}`)
    var req = trans.objectStore(cnvname).put(cnv,cnvid);
    req.onsuccess = e => {
        console.log('cnv saved');
        if(req === newCnvReq){
            newCnvReq = undefined;
        }
        if(pendingSaveRequest){
            pendingSaveRequest = false;
            save();
        } 
    };
}

var halt = false;
function continueStory(){
    while(story.canContinue){
        var text = story.Continue();
        var tags = story.currentTags;
        console.log(tags);
        tags.forEach(t=>{
            processTags(t);
        });
        if(halt){
            halt = false;
            return;
        }
        if(tags.length==0){
            var p = createStoryLine(text);
            console.log(p);
            storyContainer.appendChild(p);
        }
    }
    console.log(story.currentChoices);
    cnv.state = story.state.ToJson();
    save();
    if(story.currentChoices.length>0){
        var click = e=>{
            story.ChooseChoiceIndex(e.target.getAttribute('data-index'));
            e.target.setAttribute("disabled",true);
            Array.from(e.target.closest('.choices').getElementsByClassName("choice")).forEach(c=>{
                c.classList.add('not-chosen');
            })
            continueStory();
        };
        var container = createOptions(story.currentChoices,click);
        storyContainer.append(container);
    }
}
//only a function so I can return early rather than using a bunch of nested ifs
function processTags(tagsraw){
    var command;
    var command_param
    var action;
    var target;
    (tagsraw => {
        var tags = tagsraw.split(' ');
    
        if(tags.length<1){
            return;
        }
        var params = tags[0].matchAll(/(.*?)\((.*?)\)/g).next();
        if(params.value){
            command = params.value[1];
            command_param = params.value[2];
        }
        else{
            command = tags[0];
        }
        if(tags.length<2){
            return;
        }
        action = tags[1];
        if(tags.length<3){
            return;
        }
        target = tags[2];
    })(tagsraw);
    var action = processAction(action,target);
    switch(command){
        case 'capture':
            if(command_param){
                console.error(`invalid argument ${command_param}, capture takes no arguments`);
                return;
            }
            var i = document.createElement('input');
            i.type='text';
            i.className='capture';
            storyContainer.append(i);
            i.addEventListener('change',(e)=>{
                e.target.setAttribute("disabled","");
                action(e.target.value);
                cnv.history.push({
                    bot:false,
                    p:e.target.value
                })
                save();
                continueStory();
            });
            halt = true;
            return;
        case 'list':
            if(!command_param){
                console.error('list requires an argument');
                return;
            }
            if(!cnv.data.hasOwnProperty(command_param)){
                console.error(`could not find variable ${command_param}`);
                return;
            }
            var list = createList(cnv.data[command_param],action);
            storyContainer.appendChild(list);
            halt = true;
            return;
        case 'lval':
            var val = [];
            if(!action){
                console.error(`cannot ${action} to ${target}`);
            }
            action(val);
            return;
        case 'val':
            var val = command_param;
            if(!action){
                console.error(`cannot ${action} to ${target}`);
            }
            action(val);
            return;
        case 'save':
            //save global ink variables
            console.log('saving ink variables');
            story.variablesState._globalVariables.forEach((v,k)=>{
                cnv.ink_data[k]=v.value;
            });
            //persist to db
            save();
            return;
        // case 'run':
        //     if(!current.hasOwnProperty(command_param)){
        //         console.error(`no such function ${command_param}`);
        //         return
        //     }
        //     current[command_param]();
        //     continueStory();
        //     return;
        default:
            console.error(`refusing to process unknown command ${command}`)
    }
}
/*
ACTIONS HERE
*/
function set(target){
    return (val)=>{
        cnv.data[target]=val;
    }
}

function setInk(target){
    return (val)=>{
        story.variablesState[target]=val;
        console.log(val);
    }
}

function create(target){
    return (val)=>{
        cnv.data[target]=val;
    }
}

function append(target){
    return (val)=>{
        if(val instanceof Event){
            val = val.target.value;
        }
        cnv.data[target].push(val);
    }
}
function remove(target){
    return (val)=>{
        if(val instanceof Event){
            val = val.target.value;
        }
        cnv.data[target].splice(cnv.data[target].indexOf(val),1);
    }
}

function processAction(action, target){
    switch(action){
        case 'set':
            if(!cnv.data.hasOwnProperty(target)){
                console.error(`invalid target ${target} for set action`);
                return;
            }
            return set(target);
        case 'set_ink':
            if(story.variablesState[target]==null){
                console.error(`invalid target ${target} for set_ink action`);
                return;
            }
            return setInk(target);
        case 'append':
            if(!cnv.data.hasOwnProperty(target)){
                console.error(`invalid target ${target} for append action`);
                return;
            }
            if(!('push' in cnv.data[target])){
                console.error(`${target} is not a valid target. append must target a list`);
                return;
            }
            return append(target);
        case 'remove':
            if(!cnv.data.hasOwnProperty(target)){
                console.error(`invalid target ${target} for remove action`);
                return;
            }
            if(!('splice' in cnv.data[target] &&
                ('indexOf' in cnv.data[target]))){
                console.error(`${target} is not a valid target. remove must target a list`);
                return;
            }
            return remove(target);
        case 'create':
            if(cnv.data.hasOwnProperty(target)){
                console.log(`refusing to recreate ${target} `);
                return;
            }
            return create(target);
    }
}