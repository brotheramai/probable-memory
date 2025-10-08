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

const commandMap = new Map([
    ['capture',processCapture],
    ['list',processList],
    ['append',processAppend],
    ['remove',processRemove],
    ['createList',processCreate]
]);


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
        cnvid = parseInt(params.get(c_param));
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
    var finalClick = function(e){
        click(e.target.value);
        continueStory();
    }
    choices.forEach(c => {
        container.appendChild(createOption(c,0,finalClick));
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

function continueStory(){
    while(story.canContinue){
        var text = story.Continue().trim();
        if(text.startsWith('>')){
            var halt = false;
            halt = processCommand(text);
            if(halt){
                halt = false;
                return;
            }
        }
        else{
            var p = createStoryLine(text);
            storyContainer.appendChild(p);
        }
    }
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

function processCapture(params){
    if(params.length > 1){
        console.error(`capture takes at most one param, passed ${params}`);
        return;
    }
    var i = document.createElement('input');
    i.type='text';
    i.className='capture';
    if(params.length > 0 && params[0].length > 0){
        i.setAttribute('data-target',params[0]);
    }
    else{
        i.setAttribute('data-target','_input');
    }
    storyContainer.append(i);
    i.addEventListener('change',(e)=>{
        e.target.setAttribute("disabled","");
        if(e.target.getAttribute('data-target')!==''){
            console.log(e);
            setInk(e.target.getAttribute('data-target'))(e.target.value);
        }
        cnv.history.push({
            bot:false,
            p:e.target.value
        })
        save();
        continueStory();
    });
    return true;
}

function processList(params){
    if(params.length > 2){
        console.error('list takes at most two arguments');
        return;
    }
    if(params.length == 0){
        console.error('list requires at least one argument');
        return;
    }
    if(!cnv.data.hasOwnProperty(params[0])){
        console.error(`could not find list ${params[0]}`);
        return;
    }
    console.log(params);
    var target = '_input';
    if(params.length > 1){
        target = params[1];
    } 
    var list = createList(cnv.data[params[0]],setInk(target));
    storyContainer.appendChild(list);
    return true;
}

function processAppend(params){
    if(params.length != 2){
        console.error('append requires two parameters, the name of a list and the value to append');
        return;
    }
    if(!cnv.data.hasOwnProperty(params[0])){
        console.error(`could not find list ${params[0]}`);
        return;
    }
    cnv.data[params[0]].push(story.variablesState.GetVariableWithName(params[1]).value);
}

function processRemove(params){
    console.log(`remove ${params}`)
    if(params.length != 2){
        console.error('remove requires two parameters, the name of a list and the value to remove');
        return;
    }
    if(!cnv.data.hasOwnProperty(params[0])){
        console.error(`could not find list ${params[0]}`);
        return;
    }
    cnv.data[params[0]].splice(cnv.data[params[0]].indexOf(params[1]),1);
}

function processCreate(params){
    if(params.length != 1){
        console.error('createList requires one parameter, the name of the list to create');
    }
    if(cnv.data.hasOwnProperty(params[0])){
        console.error(`list ${params[0]} already exists, refusing to create`);
        return;
    }
    cnv.data[params[0]] = [];
}

function processCommand(text){
    // function(param1,target)
    var command;
    var param_list = [];
    var params = text.matchAll(/>(.*?)\((.*?)\)/g).next();
    if(params.value){
        command = params.value[1].trim();
        param_list = params.value[2].trim().split(',');
    }
    param_list = param_list.map(x=>x.trim());
    if(commandMap.has(command)){
        return commandMap.get(command)(param_list);
    }
    console.error(`unknown command ${command}`);
    
}

function setInk(target){
    return (val)=>{
        console.log(`setting ${target} to ${val}`)
        story.variablesState[target]=val;
        console.log(val);
    }
}