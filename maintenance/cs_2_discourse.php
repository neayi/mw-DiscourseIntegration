<?php

set_time_limit(0);

require_once __DIR__ . '/../../../maintenance/Maintenance.php';

use MediaWiki\Revision\RevisionRecord;

/**
 * Maintenance script that creates discourse threads for each discussion started in CommentStream
 *
 * @ingroup Maintenance
 */
class cs_2_discourse extends Maintenance {

    private $topicForPage = array();
    private $usersToSubscribe = array();
    private $discourseUsernames = array();

	public function __construct() {
		parent::__construct();

        $this->topicForPage = array();
        $this->usersToSubscribe = array();
        $this->discourseUsernames = array();

        $this->addOption( 'launch', 'Really launch the script', false, false );
    }

	public function execute() {
		$launch = $this->getOption( 'launch', '0' );
        if (empty($launch))
        {
            $help = "Make sure you do the following before launching this script !

                First : make a backup of your discourse instance!
                Second: desable all email !
                Third : set the following settings:

                        SiteSetting.min_post_length=1
                        SiteSetting.min_first_post_length=1
                        SiteSetting.rate_limit_create_topic=1
                        SiteSetting.rate_limit_create_post=1
                        SiteSetting.disable_emails='yes'

                Fourth: add those settings in app.yml :

                        DISCOURSE_MAX_ADMIN_API_REQS_PER_MINUTE: 5000
                        DISCOURSE_MAX_REQS_PER_IP_PER_MINUTE : 1000
                        DISCOURSE_MAX_REQS_PER_IP_PER_10_SECONDS : 500

                Fifth : now cross your fingers and relaunch the script with --launch\n\n\n";

		    $this->output($help);

            return;
        }

		$this->output( "Starting...\n\n" );

        // SELECT cst_page_id, cst_assoc_page_id, cst_comment_title, page_title
        // FROM `cs_comment_data`
        // INNER JOIN page ON page.page_id = cs_comment_data.cst_assoc_page_id
        // WHERE cst_parent_page_id IS NULL

		$dbr = $this->getDB( DB_REPLICA );
		$res = $dbr->select(
			[ 'cs_comment_data', 'page' ],
			[ 'cst_page_id', 'cst_assoc_page_id', 'cst_comment_title', 'page_title' ],
			'cst_parent_page_id IS NULL',
			__METHOD__,
			[],
			[ 'page' => [ 'INNER JOIN', 'page.page_id = cs_comment_data.cst_assoc_page_id' ] ]
		);

		foreach ( $res as $row ) {
            $this->createTopicForPage($row->cst_assoc_page_id, $row->cst_comment_title, $row->cst_page_id);
		}

        $this->subscribeUsers();

        $this->output( "\n" );
	}


    private function createTopicForPage($pageId, $commentTitle, $commentPageId)
    {
        $api = $this->getDiscourseAPI();

        $topicId = false;

        if (isset($this->topicForPage[$pageId]))
            $topicId = $this->topicForPage[$pageId];
        else
        {
            // Create the new topic in discourse...!

            // First, get the page info:
            $wikipage = WikiPage::newFromId( $pageId );
            $wikiTitle = $wikipage->getTitle();

            $username = $this->getUserNameForWikiPage($wikipage);
            $pageURL = $wikiTitle->getFullURL('', false, 'https://');
            $pageId = $wikiTitle->getArticleID();

            $this->output( "@@ $wikiTitle ($username)\n" );

            $topicId = $this->findTopicForURL($pageURL);

            if (!$topicId)
            {
                // Create the topic now
                $text = "Ce sujet de discussion accompagne la page :<br><br><a href=\"$pageURL\">$wikiTitle</a>";

                // create a topic
                $topicId = $api->createTopicForEmbed2(
                    (String)$wikiTitle,
                    $text,
                    $GLOBALS['wgDiscourseDefaultCategoryId'],
                    $username,
                    $pageURL,
                    $pageId
                );

                if (empty($topicId))
                    throw new Exception("Error Processing Request", 1);

                $this->usersToSubscribe[$username][$topicId] = true;
            }

            // cache the topic id
            $this->topicForPage[$pageId] = $topicId;
        }

        // Create a reply for this comment/question:
        $commentPage = WikiPage::newFromId( $commentPageId );

        $content = $commentPage->getContent( RevisionRecord::FOR_PUBLIC ); // RevisionRecord::RAW );
        $html = ContentHandler::getContentText( $content );

        $html = preg_replace('@{{[^}]+}}@', '', $html);

        $html = "<p><b>$commentTitle</b></p>$html";

        $username = $this->getUserNameForWikiPage($commentPage, true);
        $created_at = $this->getPageDate($commentPage);

        $this->usersToSubscribe[$username][$topicId] = true;

        $this->output( "- adding a reply from $username : $commentTitle - $created_at \n");

        $r = $api->createPost($html, $topicId, $username, $created_at);
        if (empty($r->apiresult) || !isset($r->apiresult->id))
        {
            throw new Exception("Error Processing Request " . print_r($r, true), 1);
        }

        $postNumber = $r->apiresult->post_number;

		$dbr = $this->getDB( DB_REPLICA );
		$res = $dbr->select(
			[ 'cs_comment_data' ],
			[ 'cst_page_id' ],
            [ 'cst_parent_page_id' => $commentPageId ],
			__METHOD__,
			[]
		);

		foreach ( $res as $row ) {
            $this->createReply($row->cst_page_id, $topicId, $postNumber);
		}

        sleep(2);
    }

    /**
     * Create a reply
     */
    function createReply($commentPageId, $topicId, $postNumber, $retry = 0)
    {
        $api = $this->getDiscourseAPI();

        // Create a reply for this comment/question:
        $commentPage = WikiPage::newFromId( $commentPageId );

        $content = $commentPage->getContent( RevisionRecord::FOR_PUBLIC ); // RevisionRecord::RAW );
        $html = ContentHandler::getContentText( $content );

        $html = preg_replace('@{{[^}]+}}@', '', $html);

        $username = $this->getUserNameForWikiPage($commentPage, true);
        $created_at = $this->getPageDate($commentPage);

        $this->usersToSubscribe[$username][$topicId] = true;

        $this->output("- adding a reply from $username - $created_at\n");
        $r = $api->createPost($html, $topicId, $username, $created_at, $postNumber);

        if (empty($r->apiresult) || !isset($r->apiresult->post->id))
        {
            if (!empty($r->apiresult->extras->wait_seconds) && $retry < 5)
            {
                $this->output("Got an exception - let's wait 5 seconds.\n");
                sleep(5);
                $this->createReply($commentPageId, $topicId, $postNumber, $retry ++);
            }

            throw new Exception("Error Processing Request " . print_r($r, true), 1);
        }
    }

    function getDiscourseAPI()
    {
		if ( empty($GLOBALS['wgDiscourseAPIKey']) || empty($GLOBALS['wgDiscourseHost']) )
			throw new \MWException("\nPlease define \$wgDiscourseAPIKey and \$wgDiscourseHost\n", 1);

        if ($GLOBALS['env'] == 'dev')
        {
            return new \DiscourseAPI($GLOBALS['wgDiscourseHost'], $GLOBALS['wgDiscourseAPIKey'],
                                    'http', '', '', true);
        }
        else
        {
            return new \DiscourseAPI($GLOBALS['wgDiscourseHost'], $GLOBALS['wgDiscourseAPIKey'],
                                    'https', '', '', false);
        }
    }

    function getPageDate($wikipage)
    {
        $ts = $wikipage->getTimestamp();

        $matches = array();
        if (preg_match('@([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})@', $ts, $matches))
            return $matches[1] . '-' . $matches[2] . '-' . $matches[3] . ' ' . ($matches[4] - 2) . ':' . $matches[5] . ':' . $matches[6];

        return null;
    }

    function getUserNameForWikiPage($wikipage, $bGetFirstUser = false)
    {
        $api = $this->getDiscourseAPI();
        $userEmail = '';

        // Maybe we should take the user with the most revisions, or the first, ...?
        if ($bGetFirstUser)
        {
            $contributors = $wikipage->getContributors();
            foreach ($contributors as $aContributor)
            {
                $user = $aContributor;
                $userEmail = $user->getEmail();

                if (!empty($userEmail))
                    break;
            }
        }

        if (empty($user))
        {
            $lastUserId = $wikipage->getUser();
            $user = User::newFromId( $lastUserId );

            $userEmail = $user->getEmail();

            if (empty($userEmail))
            {
                // Get the list of contributors and find the first with an email
                $contributors = $wikipage->getContributors();
                $contributorsEmails = array();
                foreach ($contributors as $aContributor)
                {
                    $user = $aContributor;
                    $mail = $user->getEmail();

                    if (!empty($mail))
                        $contributorsEmails[] = $email;
                }

                $userEmail = end($contributorsEmails);
            }
        }

        if (empty($userEmail))
            $userEmail = 'astrid.robette@neayi.com';

        $userEmail = str_replace('tripleperformance.fr', 'neayi.com', $userEmail);

        if (empty($this->discourseUsernames[$userEmail]))
        {
            $username = $api->getUsernameByEmail($userEmail);

            if (empty($username))
            {
                $this->output( "Could not find discourse user for email $userEmail - please check that this email was verified.\n" );
                $username = 'astrid.robette';
            }

            $this->discourseUsernames[$userEmail] = $userName;
        }
        else
            $userName = $this->discourseUsernames[$userEmail];

        // SELECT * FROM `users` WHERE `email` IN ('astrid.robette@neayi.com', 'b.estanguet@valdegascogne.coop',  'bertrand.gorge@neayi.com',  'delphine.da-costa@bio-occitanie.org',  'didier.fertil@m-g-p.fr',  'etadesmarais@hotmail.fr',  'hartmax@hotmail.fr',  'jd4s@orange.fr',  'maraichportecluse09@orange.fr',  'pieter@hortiproyect.eu',  'samuelfoubert@orange.fr',  'st.perrault2611@gmail.com',  'suzor@herault.chambagri.fr',  'v.soulere@hautes-pyrenees.chambagri.fr',  'zionamap@gmail.com')

        return $username;
    }

    function findTopicForURL($url)
    {
        $api = $this->getDiscourseAPI();

        $r = $api->getPostsByEmbeddedURL($url);

        if (empty($r->apiresult) || !isset($r->apiresult->topic_id))
            return false;

        return $r->apiresult->topic_id;
    }

    /**
     * Loop through all the users that have posted some post and make sure they watch the topic
     */
    function subscribeUsers()
    {
        $api = $this->getDiscourseAPI();

        // By default users who participated to the conversation are watching at level 2, so we bump them
        // to level 3
        foreach ($this->usersToSubscribe as $username => $topics)
            foreach ($topics as $topicId => $v)
                $api->watchTopic($topicId, $username);

        // Now for each topic for which a thread has been created, ask insights
        // about who decided to follow the page and subscribe them too:
        $insightsURL = $GLOBALS['wgInsightsRootAPIURL']; // http://insights/';

        foreach ($this->topicForPage as $pageId => $topicId)
        {
			$url = $insightsURL . "api/page/$pageId/followers?type=follow";

            $ch = curl_init();

            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
            $body = curl_exec($ch);

            $curl_errno = curl_errno($ch);
            $curl_error = curl_error($ch);

            if ($curl_errno > 0) {
                throw new Exception("cURL Error ($curl_errno): $curl_error", 1);
            }

            $rc = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            $resObj = new \stdClass();
            $resObj->http_code = $rc;
            $resObj->apiresult = json_decode($body);

            if (empty($resObj->apiresult) || !isset($resObj->apiresult->data))
            {
                throw new Exception("Error Processing Request " . print_r($resObj, true), 1);
            }

            foreach ($resObj->apiresult->data as $aFollower)
            {
                if (empty($aFollower->user->discourse_username))
                {
                    $this->output("Empty follower : " . print_r($aFollower, true) . "\n");
                    continue;
                }

                $username = $aFollower->user->discourse_username;

                $api->watchTopic($topicId, $username);

                $this->output("Watching topic $topicId -> " . $username . "\n");
            }
        }
    }
}

$maintClass = cs_2_discourse::class;
require_once RUN_MAINTENANCE_IF_MAIN;
