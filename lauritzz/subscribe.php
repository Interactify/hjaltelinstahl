<!doctype html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1" />
<title>Tilmeld</title>
<link rel="stylesheet" href="css/styles.css" type="text/css" media="screen" />
<link rel="stylesheet" href="css/1140.css" type="text/css" media="screen">
<style type="text/css">
html{
	height:300px;
	background-color:transparent;
		}
body{
	height:300px;
	background-color:transparent;
		}
form, .newsletterspinder, #newsletter{background-color:transparent;height:300px;}
</style>

</head>
<body>
<?php
switch ($_REQUEST[succes]){
	case 1 : echo '<div class="success" style="display:none;text-align:center;font-size:1px;">Tak. Du er nu tilmeldt vores nyhedsbrev</div>'; break; 
	
	case -1 : 
	?>
    <div class="newsletterspinder">
        <div id="newsletter">
            <p>Der skete en fejl pr�v igen</p>
            <form method="POST" action="http://pages.exacttarget.com/page.aspx?QS=330c754b5e92df745067d5fde61d0f7f9626f166020108201ae762e0410bf3ea">
            <input type="text" size="75" class="emailadress" id="Email Address" name="Email Address" onFocus="if(this.value=='Indtast din e-mail her')this.value='';" value="Indtast din e-mail her" onBlur="if(this.value=='')this.value='Indtast din e-mail her';" maxlength="100" />
            <input type="submit" value="Afmeld" class="button" />
            <input type="hidden" name="__successPage" id="__successPage" value="/templates/lauritzz/subscribe.php?succes=1" />
            <input type="hidden" name="__errorPage" id="__errorPage" value="/templates/lauritzz/subscribe.php?succes=-1" />
            <input type="hidden" name="__contextName" id="__contextName" value="FormPost" />
            <input type="hidden" name="__executionContext" id="__executionContext" value="Post" />
            </form>
        </div>
    </div>
	<?php
	break;
	default: 
		?>
        <div class="newsletterspinder">
    <div id="newsletter">
           <p>Tilmeld dig vores nyhedsbrev</p>
    <form method="POST" action="http://pages.exacttarget.com/page.aspx?QS=330c754b5e92df745067d5fde61d0f7f9626f166020108201ae762e0410bf3ea">
                <input type="text" size="75" class="emailadress" id="Email Address" name="Email Address" onFocus="if(this.value=='Indtast din e-mail her')this.value='';" value="Indtast din e-mail her" onBlur="if(this.value=='')this.value='Indtast din e-mail her';" maxlength="100" />
        <input type="submit" value="Afmeld" class="button" />
        <input type="hidden" name="__successPage" id="__successPage" value="http://hjaltelinstahl.com/templates/lauritzz/subscribe.php?succes=1" />
        <input type="hidden" name="__errorPage" id="__errorPage" value="http://hjaltelinstahl.com/templates/lauritzz/subscribe.php?succes=-1" />
        <input type="hidden" name="__contextName" id="__contextName" value="FormPost" />
        <input type="hidden" name="__executionContext" id="__executionContext" value="Post" />
  	</form>
        </div>
        </div>
		<?
	break;
}
?>
<script type="text/javascript" src="http://pages.exacttarget.com/Script/HttpRequest.js"></script>
<script type="text/javascript" src="http://pages.exacttarget.com/Script/pageTracking.js"></script>
<script type="text/javascript">
	absoluteBaseUrl = "http://pages.exacttarget.com/";
	SaveAnalyticData(56255, 'f1983809-0ceb-476a-b578-33dec50cc9dd', '6d51e49c-44aa-4662-b222-64fc1e9cb131'); 
</script>
<script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js"></script>
<script type="text/javascript">
	jQuery(document).ready(function($) {
		$('.button').click(function(){
			$('#newsletter').fadeOut(500);
		});
		$('.success').slideDown(500);
		$(".success").animate({
    fontSize: "40px",
  }, 500 );
		
	});
</script>
</body>
</html>

